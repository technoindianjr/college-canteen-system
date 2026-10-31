import 'package:canteen_core/canteen_core.dart';
import 'package:firebase_auth/firebase_auth.dart';

/// Mobile number + OTP login.
/// Real mode: Firebase Phone Auth sends the SMS and returns an ID token for our API.
/// Dev mode (--dart-define=DEV_LOGIN=true): no SMS; any 6 digits work and we send "dev:+91..." to the API.
class PhoneAuthService {
  int? _resendToken;

  /// Starts verification. Calls [onCodeSent] with a verification id, or [onAutoVerified]
  /// with an ID token when Android reads the SMS by itself.
  Future<void> sendCode({
    required String phone,
    required void Function(String verificationId) onCodeSent,
    required void Function(String idToken) onAutoVerified,
    required void Function(String message) onError,
  }) async {
    if (AppConfig.devLogin) {
      onCodeSent('dev');
      return;
    }
    await FirebaseAuth.instance.verifyPhoneNumber(
      phoneNumber: phone,
      forceResendingToken: _resendToken,
      timeout: const Duration(seconds: 60),
      verificationCompleted: (credential) async {
        try {
          final result = await FirebaseAuth.instance.signInWithCredential(credential);
          final token = await result.user?.getIdToken();
          if (token != null) onAutoVerified(token);
        } on FirebaseAuthException catch (e) {
          onError(_message(e));
        }
      },
      verificationFailed: (e) => onError(_message(e)),
      codeSent: (verificationId, resendToken) {
        _resendToken = resendToken;
        onCodeSent(verificationId);
      },
      codeAutoRetrievalTimeout: (_) {},
    );
  }

  /// Checks the 6-digit code and returns the ID token to send to the API.
  Future<String> verifyCode({required String phone, required String verificationId, required String smsCode}) async {
    if (AppConfig.devLogin) return 'dev:$phone';
    try {
      final credential = PhoneAuthProvider.credential(verificationId: verificationId, smsCode: smsCode);
      final result = await FirebaseAuth.instance.signInWithCredential(credential);
      final token = await result.user?.getIdToken();
      if (token == null) throw const ApiException('otp', 'Could not verify the code, please try again');
      return token;
    } on FirebaseAuthException catch (e) {
      throw ApiException('otp', _message(e));
    }
  }

  Future<void> signOut() async {
    if (!AppConfig.devLogin) await FirebaseAuth.instance.signOut();
  }

  static String _message(FirebaseAuthException e) => switch (e.code) {
        'invalid-verification-code' => 'Wrong code. Check the SMS and try again.',
        'session-expired' => 'The code expired. Tap "Resend code".',
        'invalid-phone-number' => 'That mobile number looks wrong.',
        'too-many-requests' => 'Too many attempts. Please wait a few minutes.',
        'network-request-failed' => 'No internet connection.',
        _ => e.message ?? 'Verification failed (${e.code})',
      };
}
