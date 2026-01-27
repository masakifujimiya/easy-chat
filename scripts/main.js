'use strict';

class EasyChat {
  /**
   * @desc Template for messages.
   */
  static get MESSAGE_TEMPLATE() {
    return (
      '<div class="message-container">' +
        '<div class="spacing"><div class="pic"></div></div>' +
        '<div class="message"></div>' +
        '<div class="name"></div>' +
      '</div>'
    );
  }

  /**
   * @desc Constructor
   */
  constructor() {
    this.checkSetup();

    // --- Shortcuts to DOM Elements ---
    this.messageList    = document.getElementById('messages');
    this.messageForm    = document.getElementById('message-form');
    this.messageInput   = document.getElementById('message');
    this.submitButton   = document.getElementById('submit');
    this.imageForm      = document.getElementById('image-form');
    this.mediaCapture   = document.getElementById('mediaCapture');
    this.userPic        = document.getElementById('user-pic');
    this.userName       = document.getElementById('user-name');
    this.signInButton   = document.getElementById('sign-in');
    this.signOutButton  = document.getElementById('sign-out');
    this.signInSnackbar = document.getElementById('must-signin-snackbar');

    // --- Event bindings ---
    if (this.messageForm) {
      this.messageForm.addEventListener('submit', this.saveMessage.bind(this));
    }
    if (this.signOutButton) {
      this.signOutButton.addEventListener('click', this.signOut.bind(this));
    }

    // メール＋パス運用では、チャット画面のサインインボタンは login.html に誘導
    if (this.signInButton) {
      this.signInButton.addEventListener('click', () => {
        window.location.href = './login.html';
      });
    }

    // Toggle for the send button.
    const buttonTogglingHandler = this.toggleButton.bind(this);
    if (this.messageInput) {
      this.messageInput.addEventListener('keyup', buttonTogglingHandler);
      this.messageInput.addEventListener('change', buttonTogglingHandler);
    }

    // --- Firebase initialize ---
    this.initFirebase();
    this.initAuth();

    // 初期ロード（リアルタイム購読があるため必須ではないが互換のため置く）
    this.loadMessages();

    // デバッグ：DOM 取得状況を一度ログ
    console.log('[dom] signInButton:', this.signInButton, 'signOutButton:', this.signOutButton);
  }

  // --- Firebase / Firestore 初期化 -------------------------------------------------

  initFirebase() {
    // Firestore 初期化
    this.firestore = firebase.firestore();

    // Realtime update listener
    this.unsubscribeMessages = this.firestore
      .collection('messages')
      .orderBy('timestamp')
      .onSnapshot((querySnapshot) => {
        querySnapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data() || {};
            this.displayMessage(
              change.doc.id,
              data.name,
              data.message,
              data.photoURL
            );
          }
        });
      }, (err) => {
        console.error('[firestore] onSnapshot error:', err);
      });
  }

  initAuth() {
    // Firebase Auth 初期化
    this.auth = firebase.auth();
    this.auth.onAuthStateChanged(this.onAuthStateChanged.bind(this));
  }

  // --- 認証状態変化 ---------------------------------------------------------------

  onAuthStateChanged(user) {
    console.log('[auth] state:', user ? 'SIGNED-IN' : 'SIGNED-OUT', user?.uid || '');

    if (user) {
      // 1) displayName が未設定なら、メールで上書き（初回のみ）
      if (!user.displayName && user.email) {
        user.updateProfile({ displayName: user.email })
          .catch((err) => console.error('[auth] updateProfile failed:', err));
      }

      // 2) ヘッダ表示（フォールバックは email）
      const profilePicUrl = this.resolvePhotoURL(user);
      const nameText = user.displayName || user.email || '匿名';

      if (this.userPic)  this.userPic.style.backgroundImage = `url(${profilePicUrl})`;
      if (this.userName) this.userName.textContent = nameText;

      // --- UI 切り替え：hidden を boolean で確実に制御 ---
      if (this.userName)      this.userName.hidden = false;
      if (this.userPic)       this.userPic.hidden = false;
      if (this.signOutButton) this.signOutButton.hidden = false;
      if (this.signInButton)  this.signInButton.hidden = true;

      // MDL の再適用（必要時）
      if (window.componentHandler) componentHandler.upgradeDom();

      // 既にリアルタイム購読を始めているため、明示のロードは任意
      if (typeof this.loadMessages === 'function') this.loadMessages();

    } else {
      // --- ログアウト時 UI ---
      if (this.userName)      this.userName.hidden = true;
      if (this.userPic)       this.userPic.hidden = true;
      if (this.signOutButton) this.signOutButton.hidden = true;
      if (this.signInButton)  this.signInButton.hidden = false;

      // MDL の再適用（必要時）
      if (window.componentHandler) componentHandler.upgradeDom();

      // ログイン画面へ即時遷移（戻る無効にするなら replace）
      window.location.replace('./login.html');
    }
  }

  // --- ユーティリティ --------------------------------------------------------------

  resolvePhotoURL(user) {
    return (user && user.photoURL) || '/images/profile_placeholder.png';
  }

  // Firestore 初期ロード（必要な場合のみ。リアルタイムで十分なら中身は空でもOK）
  loadMessages() {
    // 既存コメントアウトと同等。リアルタイム購読があるため必須ではありません。
    // 必要ならここで最新 N 件の初期読み込みを実装してください。
  }

  // --- 送信 / 保存 ----------------------------------------------------------------

  saveMessage(e) {
    e.preventDefault();

    if (this.messageInput && this.messageInput.value && this.checkSignedInWithMessage()) {
      const user = this.auth.currentUser;
      const name = (user && (user.displayName || user.email)) || '匿名';
      const photoURL = this.resolvePhotoURL(user);

      this.firestore
        .collection('messages')
        .add({
          name: name,
          message: this.messageInput.value,
          photoURL: photoURL,
          timestamp: new Date()
        })
        .then(() => {
          // 送信成功時の後処理
        })
        .catch((error) => {
          console.error('[firestore] add message error:', error);
        });

      this.resetMaterialTextfield(this.messageInput);
      this.toggleButton();
    }
  }

  // --- サインイン / サインアウト ---------------------------------------------------

  // Google サインインは廃止。メール＋パスは login.html 側で行う。
  signIn() {
    window.location.href = './login.html';
  }

  async signOut() {
    try {
      await this.auth.signOut();
      console.log('[auth] signed out');
      // 認証リスナー側の遷移に任せても良いが、明示的に遷移させる場合：
      window.location.replace('./login.html');
    } catch (e) {
      console.error('[auth] signOut error:', e);
    }
  }

  // --- 各種 UI 補助 ---------------------------------------------------------------

  checkSignedInWithMessage() {
    if (this.auth.currentUser) return true;

    // Snackbar で通知（存在すれば）
    const data = { message: 'You must sign-in first', timeout: 2000 };
    if (this.signInSnackbar && this.signInSnackbar.MaterialSnackbar) {
      this.signInSnackbar.MaterialSnackbar.showSnackbar(data);
    } else {
      console.warn('[ui] snackbar not available:', data.message);
    }
    return false;
    }

  resetMaterialTextfield(element) {
    element.value = '';
    // MDL の表示更新
    if (element.parentNode && element.parentNode.MaterialTextfield) {
      element.parentNode.MaterialTextfield.boundUpdateClassesHandler();
    }
  }

  displayMessage(key, name, text, picUrl) {
    let div = document.getElementById(key);

    if (!div) {
      const container = document.createElement('div');
      container.innerHTML = EasyChat.MESSAGE_TEMPLATE;
      div = container.firstChild;
      div.setAttribute('id', key);
      this.messageList.appendChild(div);
    }

    if (picUrl) {
      div.querySelector('.pic').style.backgroundImage = `url(${picUrl})`;
    }

    // name が空の既存データ対策
    div.querySelector('.name').textContent = name || '匿名';

    const messageElement = div.querySelector('.message');
    if (text != null && text !== undefined) {
      // まずプレーンテキストとして安全に代入 → その後改行のみ <br> に変換
      messageElement.textContent = text;
      // innerHTML 再代入の前にテキストを取得し、改行を <br> に置換
      const safe = messageElement.textContent.replace(/\n/g, '<br>');
      messageElement.innerHTML = safe;
    }

    // フェードイン＆スクロール
    setTimeout(() => div.classList.add('visible'), 1);
    this.messageList.scrollTop = this.messageList.scrollHeight;

    if (this.messageInput) {
      this.messageInput.focus();
    }
  }

  toggleButton() {
    if (!this.submitButton || !this.messageInput) return;

    if (this.messageInput.value) {
      this.submitButton.removeAttribute('disabled');
    } else {
      this.submitButton.setAttribute('disabled', 'true');
    }
  }

  checkSetup() {
    if (!window.firebase || !(firebase.app instanceof Function) || !firebase.app().options) {
      window.alert(
        'You have not configured and imported the Firebase SDK. ' +
        'Make sure you go through the codelab setup instructions and make ' +
        'sure you are running the codelab using `firebase serve`'
      );
    }
  }
}

// 起動
window.onload = function () {
  // Initializes EasyChat.
  window.easyChat = new EasyChat();
};
