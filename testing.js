<script>
(function(){
  const REDIRECT_URL = "https://44hub.blogspot.com/p/turn-off-adblock.html"; // Ganti URL redirect
  const REDIRECT_TIME = 8000; // waktu redirect (ms)

  let redirectTimer;

  // ===== CSS Dinamis =====
  const style = document.createElement('style');
  style.textContent = `
    html.ab-blur body {
      filter: blur(5px);
      pointer-events: none;
      user-select: none;
    }
    .ab-overlay {
      position: fixed; inset: 0; z-index: 99999;
      background: rgba(0,0,0,0.55);
      display:flex; align-items:center; justify-content:center;
      font-family: system-ui, -apple-system, "Segoe UI", Roboto;
    }
    .ab-box {
      width: 90%; max-width: 400px;
      background: #fff; border-radius: 10px; padding: 18px;
      text-align: center; color: #111;
      box-shadow: 0 8px 30px rgba(0,0,0,0.4);
    }
    .ab-box h3 { margin: 0 0 12px; font-size: 18px; }
    .ab-actions { display:flex; justify-content:center; gap:10px; margin-top: 12px; }
    .ab-btn {
      padding:8px 12px; border-radius:6px; border:0; cursor:pointer; font-weight:600;
    }
    .ab-btn.primary { background:#0b74de; color:#fff; }
  `;
  document.head.appendChild(style);

  // ===== Buat Modal Dinamis =====
  function showModal() {
    if (document.getElementById('ab-popup')) return;

    document.documentElement.classList.add('ab-blur');

    const overlay = document.createElement('div');
    overlay.className = 'ab-overlay';
    overlay.id = 'ab-popup';

    overlay.innerHTML = `
      <div class="ab-box">
        <h3>⚠️ Please change the browser or turn off the Ad Blocker to continue.</h3>
        <div class="ab-actions">
          <button class="ab-btn primary" id="ab-recheck">Recheck</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('ab-recheck').addEventListener('click', ()=>{
      clearTimeout(redirectTimer);
      removeModal();
      setTimeout(runChecks, 1000);
    });

    redirectTimer = setTimeout(()=>{
      window.location.href = REDIRECT_URL;
    }, REDIRECT_TIME);
  }

  // ===== Hapus Modal =====
  function removeModal(){
    const popup = document.getElementById('ab-popup');
    if (popup) popup.remove();
    document.documentElement.classList.remove('ab-blur');
  }

  // ===== Deteksi Brave =====
  function detectBrave(){
    try{
      if (navigator.brave && navigator.brave.isBrave){
        return navigator.brave.isBrave().then(res => res ? 'brave' : false).catch(()=>false);
      }
    }catch(e){}
    return Promise.resolve(false);
  }

  // ===== Deteksi Adblock (Bait) =====
  function baitCheck(){
    return new Promise(res=>{
      const bait = document.createElement('div');
      bait.className = 'adsbox';
      bait.style.cssText = 'width:1px;height:1px;position:fixed;left:-9999px;top:-9999px;';
      document.body.appendChild(bait);
      setTimeout(()=>{
        const blocked = !bait.offsetParent || bait.offsetHeight === 0 || getComputedStyle(bait).display === 'none';
        bait.remove();
        res(blocked);
      },50);
    });
  }

  // ===== Deteksi Script Ad =====
  function scriptCheck(){
    return new Promise(res=>{
      const s = document.createElement('script');
      s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
      let timeout = setTimeout(()=>res(true),1500);
      s.onerror = ()=>{ clearTimeout(timeout); res(true); };
      s.onload = ()=>{ clearTimeout(timeout); res(false); };
      document.head.appendChild(s);
      setTimeout(()=>{ try{s.remove();}catch(e){} }, 5000);
    });
  }

  // ===== Jalankan Cek =====
  function runChecks(){
    Promise.all([detectBrave(), baitCheck(), scriptCheck()]).then(r=>{
      const brave = r[0], bait = r[1], script = r[2];
      if (brave || bait || script) showModal();
    });
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(runChecks, 600);
  } else {
    window.addEventListener('DOMContentLoaded', ()=> setTimeout(runChecks, 600));
  }
})();
</script>
