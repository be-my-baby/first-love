(async function () {
  const grid = document.getElementById('grid');
  const countEl = document.getElementById('photoCount');
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxVideo = document.getElementById('lightboxVideo');
  const lightboxClose = document.getElementById('lightboxClose');

  // Chặn menu chuột phải trên toàn trang
  document.addEventListener('contextmenu', (e) => e.preventDefault());

  // Vùng đệm: tải trước / giữ lại nội dung cách viewport bao nhiêu px
  const MOUNT_MARGIN = '900px 0px 900px 0px';       // vùng để BẮT ĐẦU tải ảnh/video
  const UNMOUNT_MARGIN = '-2400px 0px -2400px 0px'; // vùng để GIẢI PHÓNG nội dung đã ra xa
  const EAGER_COUNT = 8; // số ảnh đầu tiên tải ngay lập tức, ưu tiên cao (above the fold)

  // Ưu tiên nhạc: chờ music.js báo "sẵn sàng" (đã canplay, lỗi, hoặc hết thời gian chờ)
  // rồi mới bắt đầu tải manifest.json + dựng lưới ảnh. Nếu music.js chưa tồn tại/lỗi
  // (ví dụ trang không dùng nhạc), bỏ qua bước chờ này ngay.
  if (window.GalleryMusic && window.GalleryMusic.ready) {
    try { await window.GalleryMusic.ready; } catch (err) { /* bỏ qua, vẫn tiếp tục tải ảnh */ }
  }

  let items = [];
  try {
    const res = await fetch('manifest.json', { cache: 'no-store' });
    items = await res.json();
  } catch (err) {
    grid.innerHTML = '<p style="padding:20px;color:#1090e6">Không tìm thấy manifest.json. Hãy dùng công cụ offline để tạo danh sách ảnh/video trước.</p>';
    return;
  }

  countEl.textContent = items.length ? `${items.length} mục` : '';

  // Xáo trộn thứ tự để bố cục lưới trông linh hoạt, tự nhiên hơn mỗi lần tải trang
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  shuffle(items);

  const tiles = [];

  items.forEach((item, index) => {
    const isVideo = item.type === 'video';
    const tile = document.createElement('div');
    tile.className = 'tile placeholder' + (isVideo ? ' is-video' : '');
    tile.style.aspectRatio = `${item.w} / ${item.h}`;
    tile.dataset.index = String(index);
    tile.dataset.type = isVideo ? 'video' : 'image';
    tile.dataset.src = item.file;
    tile.dataset.poster = item.poster || '';
    tile.dataset.w = item.w;
    tile.dataset.h = item.h;
    tile.setAttribute('role', 'button');
    tile.setAttribute('tabindex', '0');
    tile.setAttribute('aria-label', isVideo ? `Xem video ${index + 1}` : `Xem ảnh ${index + 1}`);
    grid.appendChild(tile);
    tiles.push(tile);
  });

  function mount(tile) {
    if (tile.dataset.mounted === '1') return;
    const index = Number(tile.dataset.index);
    const isVideo = tile.dataset.type === 'video';

    // Ảnh đại diện (poster với video, ảnh thật với image)
    const posterImg = document.createElement('img');
    posterImg.className = 'poster';
    posterImg.loading = index < EAGER_COUNT ? 'eager' : 'lazy';
    posterImg.fetchPriority = index < EAGER_COUNT ? 'high' : 'low';
    posterImg.decoding = 'async';
    posterImg.width = Number(tile.dataset.w);
    posterImg.height = Number(tile.dataset.h);
    posterImg.alt = tile.getAttribute('aria-label');
    posterImg.src = isVideo ? tile.dataset.poster : tile.dataset.src;
    posterImg.addEventListener('load', () => tile.classList.add('loaded'), { once: true });
    tile.appendChild(posterImg);

    if (isVideo) {
      const badge = document.createElement('span');
      badge.className = 'play-badge';
      badge.innerHTML = '&#9658;';
      tile.appendChild(badge);

      const video = document.createElement('video');
      video.className = 'preview-video';
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = 'none';
      video.poster = tile.dataset.poster;
      const source = document.createElement('source');
      source.dataset.src = tile.dataset.src; // chỉ gán src thật khi hover, tránh tải video ngầm hàng loạt
      video.appendChild(source);
      tile.appendChild(video);

      tile.addEventListener('mouseenter', () => {
        if (!video.src) video.src = tile.dataset.src;
        video.currentTime = 0;
        video.play().catch(() => {});
        tile.classList.add('hover-video');
      });
      tile.addEventListener('mouseleave', () => {
        video.pause();
        tile.classList.remove('hover-video');
      });
    }

    tile.classList.remove('placeholder');
    tile.dataset.mounted = '1';
  }

  function unmount(tile) {
    if (tile.dataset.mounted !== '1') return;
    tile.innerHTML = '';
    tile.classList.remove('loaded', 'hover-video');
    tile.classList.add('placeholder');
    tile.dataset.mounted = '0';
  }

  const mountObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) mount(entry.target);
    });
  }, { root: null, rootMargin: MOUNT_MARGIN, threshold: 0 });

  const unmountObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) unmount(entry.target);
    });
  }, { root: null, rootMargin: UNMOUNT_MARGIN, threshold: 0 });

  // Vài mục đầu tiên mount ngay lập tức, không chờ IntersectionObserver
  tiles.slice(0, EAGER_COUNT).forEach(mount);

  tiles.forEach((tile) => {
    mountObserver.observe(tile);
    unmountObserver.observe(tile);

    const open = () => {
      if (tile.dataset.mounted !== '1') return;
      if (tile.dataset.type === 'video') {
        lightboxImg.hidden = true;
        lightboxVideo.hidden = false;
        lightboxVideo.src = tile.dataset.src;
        lightboxVideo.poster = tile.dataset.poster;
        lightboxVideo.muted = false;
        // Tạm dừng nhạc nền khi mở video, tránh chồng tiếng
        if (window.GalleryMusic) window.GalleryMusic.pauseForVideo();
        lightboxVideo.play().catch(() => {});
      } else {
        lightboxVideo.hidden = true;
        lightboxVideo.pause();
        lightboxVideo.removeAttribute('src');
        lightboxImg.hidden = false;
        lightboxImg.src = tile.dataset.src;
      }
      lightbox.classList.add('is-open');
    };
    tile.addEventListener('click', open);
    tile.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });
  });

  function closeLightbox() {
    lightbox.classList.remove('is-open');
    lightboxImg.src = '';
    lightboxVideo.pause();
    lightboxVideo.removeAttribute('src');
    // Phát lại nhạc nền (nếu người dùng đang để bật) khi đóng video
    if (window.GalleryMusic) window.GalleryMusic.resumeAfterVideo();
  }
  lightboxClose.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLightbox(); });
})();
