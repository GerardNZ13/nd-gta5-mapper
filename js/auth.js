/**
 * Firebase Authentication. When AUTH_CONFIG.requireAuth is true, users must sign in before using the map.
 */
(function () {
  const requireAuth = typeof AUTH_CONFIG !== 'undefined' && AUTH_CONFIG && AUTH_CONFIG.requireAuth === true;
  const hasFirebase = typeof DATA_CONFIG !== 'undefined' && DATA_CONFIG && DATA_CONFIG.firebase && DATA_CONFIG.firebase.apiKey;

  function getAuthScreen() {
    return document.getElementById('auth-screen');
  }

  function getAppEl() {
    return document.getElementById('app');
  }

  window.showAuthScreen = function () {
    const el = getAuthScreen();
    const app = getAppEl();
    if (el) el.classList.remove('hidden');
    if (app) app.classList.add('auth-hidden');
  };

  window.hideAuthScreen = function () {
    const el = getAuthScreen();
    const app = getAppEl();
    if (el) el.classList.add('hidden');
    if (app) app.classList.remove('auth-hidden');
  };

  window.getCurrentUser = function () {
    return firebase.auth && firebase.auth().currentUser || null;
  };

  window.signOut = function () {
    if (firebase.auth) firebase.auth().signOut();
  };

  function getAuth() {
    return firebase.auth && firebase.auth() || null;
  }

  window.signInWithEmail = function (email, password) {
    const auth = getAuth();
    if (!auth) return Promise.reject(new Error('Firebase Auth not loaded'));
    return auth.signInWithEmailAndPassword(email, password);
  };

  window.signUpWithEmail = function (email, password) {
    const auth = getAuth();
    if (!auth) return Promise.reject(new Error('Firebase Auth not loaded'));
    return auth.createUserWithEmailAndPassword(email, password);
  };

  window.signInWithGoogle = function () {
    const auth = getAuth();
    if (!auth) return Promise.reject(new Error('Firebase Auth not loaded'));
    const provider = new firebase.auth.GoogleAuthProvider();
    return auth.signInWithPopup(provider);
  };

  /**
   * Call when auth is ready. If requireAuth: calls onReady(user) after sign-in, or shows login. If !requireAuth: calls onReady(null) immediately.
   */
  window.initAuth = function (onReady) {
    if (!requireAuth) {
      hideAuthScreen();
      if (onReady) onReady(null);
      return;
    }

    if (!hasFirebase) {
      console.warn('AUTH_CONFIG.requireAuth is true but Firebase is not configured. Set DATA_CONFIG.firebase in js/config.js.');
      hideAuthScreen();
      if (onReady) onReady(null);
      return;
    }

    if (!firebase.auth) {
      console.warn('Firebase Auth not loaded.');
      hideAuthScreen();
      if (onReady) onReady(null);
      return;
    }

    firebase.auth().onAuthStateChanged(function (user) {
      if (user) {
        hideAuthScreen();
        if (onReady) onReady(user);
      } else {
        showAuthScreen();
        if (onReady) onReady(null);
      }
    });
  };

  (function bindAuthForm() {
    var form = document.getElementById('auth-form');
    var emailEl = document.getElementById('auth-email');
    var passwordEl = document.getElementById('auth-password');
    var errorEl = document.getElementById('auth-error');
    var signInBtn = document.getElementById('auth-signin');
    var signUpBtn = document.getElementById('auth-signup');
    var googleWrap = document.getElementById('auth-google-wrap');
    var googleBtn = document.getElementById('auth-google');

    var methods = (typeof AUTH_CONFIG !== 'undefined' && AUTH_CONFIG && AUTH_CONFIG.signInMethods) || ['email'];
    if (googleWrap && methods.indexOf('google') !== -1) googleWrap.hidden = false;

    function showError(msg) {
      if (errorEl) {
        errorEl.textContent = msg || '';
        errorEl.hidden = !msg;
      }
    }

    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var email = emailEl && emailEl.value.trim();
        var password = passwordEl && passwordEl.value;
        if (!email || !password) {
          showError('Enter email and password.');
          return;
        }
        showError('');
        signInBtn.disabled = true;
        signUpBtn.disabled = true;
        signInWithEmail(email, password).then(function () {
          showError('');
        }).catch(function (err) {
          showError(err.message || 'Sign in failed.');
        }).finally(function () {
          signInBtn.disabled = false;
          signUpBtn.disabled = false;
        });
      });
    }

    if (signUpBtn) {
      signUpBtn.addEventListener('click', function () {
        var email = emailEl && emailEl.value.trim();
        var password = passwordEl && passwordEl.value;
        if (!email || !password) {
          showError('Enter email and password.');
          return;
        }
        if (password.length < 6) {
          showError('Password must be at least 6 characters.');
          return;
        }
        showError('');
        signInBtn.disabled = true;
        signUpBtn.disabled = true;
        signUpWithEmail(email, password).then(function () {
          showError('');
        }).catch(function (err) {
          showError(err.message || 'Create account failed.');
        }).finally(function () {
          signInBtn.disabled = false;
          signUpBtn.disabled = false;
        });
      });
    }

    if (googleBtn) {
      googleBtn.addEventListener('click', function () {
        showError('');
        googleBtn.disabled = true;
        signInWithGoogle().then(function () {
          showError('');
        }).catch(function (err) {
          showError(err.message || 'Google sign in failed.');
        }).finally(function () {
          googleBtn.disabled = false;
        });
      });
    }
  })();
})();
