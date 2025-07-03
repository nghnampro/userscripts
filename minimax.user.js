// ==UserScript==
// @name         Minimax TTS Splitter (Tách theo .?!。？！ + \n, ≤ 300)
// @namespace    http://tampermonkey.net/
// @version      4.3
// @description  Tách câu dựa trên dấu .?! (Latinh), 。？！ (CJK) và xuống dòng \n. Theo dõi DOM Minimax không vượt quá 300 ký tự. Gõ từng đoạn, lưu lại và cho phép tải txt/json. Tối ưu cho mọi ngôn ngữ TTS (Anh/Trung/Nhật/Hàn...) trên minimax.io/audio/text-to-speech UI React đặc biệt.
// @author       You
// @match        https://www.minimax.io/audio/text-to-speech*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const MAX_LIMIT = 300;
  let chunks = [];

  function getTextarea() {
    return document.querySelector('textarea.ant-input');
  }

  function getCharCountFromDOM() {
    const el = Array.from(document.querySelectorAll('div.flex')).find(div =>
      div.textContent.includes('/ 5,000 character')
    );
    if (!el) return 0;
    const match = el.textContent.match(/(\d+)\s*\/\s*5,000/);
    return match ? parseInt(match[1], 10) : 0;
  }

  function inject(text) {
    const textarea = getTextarea();
    textarea.focus();
    document.execCommand('selectAll', false, null);
    document.execCommand('delete', false, null);
    document.execCommand('insertText', false, text);
  }

  // ✅ Kết hợp dấu Latinh (.?!), CJK (。？！), và xuống dòng \n
  function splitBySentenceChunks(text) {
    const regex = /[^.?!。？！\n]+[.?!。？！]?/g;
    return text.match(regex)?.map(s => s.trim()).filter(Boolean) || [];
  }

  async function typeByChunk(segments) {
    chunks = [];
    let i = 0;

    while (i < segments.length) {
      const buffer = [];
      let injected = '';

      while (i < segments.length) {
        buffer.push(segments[i]);
        injected = buffer.join(' ').trim();
        inject(injected);
        await waitForReactDOM();
        const count = getCharCountFromDOM();

        if (count > MAX_LIMIT) {
          buffer.pop(); // loại bỏ câu gây tràn
          break;
        }
        i++;
      }

      const chunk = buffer.join(' ').trim();
      if (chunk) {
        chunks.push(chunk);
        inject('');
        await wait(200);
      } else {
        const fallback = segments[i].slice(0, MAX_LIMIT);
        chunks.push(fallback);
        i++;
      }
    }
  }

  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function waitForReactDOM(retries = 10) {
    for (let i = 0; i < retries; i++) {
      await wait(100);
      if (getCharCountFromDOM() > 0) break;
    }
  }

  async function handleSplitRun(inputText) {
    const raw = inputText.trim();
    if (!raw) return alert("⛔ Chưa có nội dung để xử lý");

    const segments = splitBySentenceChunks(raw);
    await typeByChunk(segments);

    inject(chunks[0]);
    alert(`✅ Đã tách thành ${chunks.length} đoạn. Đoạn đầu đã gõ vào Minimax.`);

    showDownloadButtons();
  }

  function showDownloadButtons() {
    const existing = document.getElementById('minimax-export-buttons');
    if (existing) existing.remove();

    const wrapper = document.createElement('div');
    wrapper.id = 'minimax-export-buttons';
    wrapper.style.marginTop = '10px';
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.gap = '6px';

    const btnText = document.createElement('button');
    btnText.textContent = '💾 Tải .txt';
    styleButton(btnText, '#28a745');
    btnText.onclick = () => {
      const blob = new Blob([chunks.join('\n\n')], { type: 'text/plain' });
      downloadBlob(blob, 'minimax_split.txt');
    };

    const btnJson = document.createElement('button');
    btnJson.textContent = '💾 Tải .json';
    styleButton(btnJson, '#17a2b8');
    btnJson.onclick = () => {
      const blob = new Blob([JSON.stringify(chunks, null, 2)], { type: 'application/json' });
      downloadBlob(blob, 'minimax_chunks.json');
    };

    wrapper.appendChild(btnText);
    wrapper.appendChild(btnJson);
    document.getElementById('minimax-split-wrapper')?.appendChild(wrapper);
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function styleButton(btn, bg = '#007bff') {
    btn.style.padding = '8px';
    btn.style.backgroundColor = bg;
    btn.style.color = '#fff';
    btn.style.border = 'none';
    btn.style.borderRadius = '4px';
    btn.style.cursor = 'pointer';
    btn.style.fontSize = '14px';
  }

  function createUI() {
    const wrapper = document.createElement('div');
    wrapper.id = 'minimax-split-wrapper';
    wrapper.style.position = 'fixed';
    wrapper.style.top = '80px';
    wrapper.style.left = '20px';
    wrapper.style.zIndex = 9999;
    wrapper.style.background = '#fff';
    wrapper.style.border = '1px solid #ccc';
    wrapper.style.padding = '10px';
    wrapper.style.borderRadius = '6px';
    wrapper.style.boxShadow = '0 0 6px rgba(0,0,0,0.2)';
    wrapper.style.width = '320px';

    const textarea = document.createElement('textarea');
    textarea.placeholder = '✍ Dán văn bản (mọi ngôn ngữ) vào đây...';
    textarea.rows = 10;
    textarea.style.width = '100%';
    textarea.style.padding = '8px';
    textarea.style.marginBottom = '10px';
    textarea.style.resize = 'vertical';

    const button = document.createElement('button');
    button.textContent = '✂️ Tách & Gõ (≤300, theo dấu câu)';
    styleButton(button);
    button.onclick = () => handleSplitRun(textarea.value);

    wrapper.appendChild(textarea);
    wrapper.appendChild(button);
    document.body.appendChild(wrapper);
  }

  window.addEventListener('load', () => {
    setTimeout(() => {
      if (!getTextarea()) {
        alert("⚠️ Không tìm thấy textarea Minimax.");
        return;
      }
      createUI();
    }, 3000);
  });
})();
