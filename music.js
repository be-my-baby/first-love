// ============================================================
// CẤU HÌNH NHẠC NỀN (file mp3 cục bộ)
// 1. Tạo thư mục "music/" cạnh index.html.
// 2. Bỏ các file .mp3 đã chuẩn bị vào đó.
// 3. Liệt kê tên file theo đúng thứ tự muốn phát vào mảng dưới đây.
//    Có thể để 1 file duy nhất, hoặc nhiều file sẽ tự phát nối tiếp và lặp lại từ đầu.
// ============================================================
const MUSIC_TRACKS = [
  'music/track-01.mp3',
  'music/track-02.mp3',
  'music/track-03.mp3',
];

// true = mỗi lần tải trang sẽ phát các bài theo thứ tự ngẫu nhiên khác nhau
// false = luôn phát đúng theo thứ tự khai báo ở trên
const SHUFFLE_TRACKS = true;

(function () {
  const toggleBtn = document.getElementById('musicToggle');
  const iconOn = document.getElementById('musicIconOn');
  const iconOff = document.getElementById('musicIconOff');
  const audio = document.getElementById('bg-audio');

  let currentTrack = 0;
  // Mặc định vào trang là đang BẬT nhạc
  let musicEnabled = true;
  // true khi đang mở video trong lightbox (nhạc phải im lặng lúc này)
  let videoIsOpen = false;

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  const playOrder = SHUFFLE_TRACKS ? shuffle(MUSIC_TRACKS.slice()) : MUSIC_TRACKS.slice();

  if (playOrder.length) {
    audio.src = playOrder[0];
  }

  function setButtonUI() {
    toggleBtn.setAttribute('aria-pressed', String(musicEnabled));
    iconOn.hidden = !musicEnabled;
    iconOff.hidden = musicEnabled;
    toggleBtn.classList.toggle('is-off', !musicEnabled);
  }
  setButtonUI();

  function tryPlay() {
    if (!musicEnabled || videoIsOpen || !playOrder.length) return;
    audio.play().catch(() => {
      // Trình duyệt chặn autoplay có tiếng cho tới khi có tương tác đầu tiên — sẽ thử lại ở onFirstInteraction
    });
  }

  function tryPause() {
    audio.pause();
  }

  // Chuyển bài kế tiếp khi bài hiện tại phát xong; hết danh sách thì quay lại bài đầu
  audio.addEventListener('ended', () => {
    if (!playOrder.length) return;
    currentTrack = (currentTrack + 1) % playOrder.length;
    audio.src = playOrder[currentTrack];
    tryPlay();
  });

  // Trình duyệt thường chặn autoplay có tiếng cho tới khi có tương tác đầu tiên của người dùng.
  // Nghe tương tác đầu tiên (click/gõ phím/chạm) để thử phát lại nếu trạng thái mong muốn là "đang bật".
  let firstInteractionDone = false;
  function onFirstInteraction() {
    if (firstInteractionDone) return;
    firstInteractionDone = true;
    tryPlay();
  }
  ['click', 'keydown', 'touchstart'].forEach((evt) => {
    document.addEventListener(evt, onFirstInteraction, { once: true, passive: true });
  });

  // Thử phát ngay khi trang tải xong (sẽ thành công nếu trình duyệt cho phép,
  // nếu không thì sẽ tự phát ở lần tương tác đầu tiên phía trên)
  tryPlay();

  toggleBtn.addEventListener('click', () => {
    musicEnabled = !musicEnabled;
    setButtonUI();
    if (musicEnabled) {
      tryPlay();
    } else {
      tryPause();
    }
  });

  // API dùng chung cho app.js: tạm dừng nhạc khi mở video, phát lại theo trạng thái nút khi đóng video
  window.GalleryMusic = {
    pauseForVideo() {
      videoIsOpen = true;
      tryPause();
    },
    resumeAfterVideo() {
      videoIsOpen = false;
      tryPlay();
    },
  };
})();
