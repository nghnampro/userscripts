
// ==UserScript==
// @name         Auto Prompt Runner for Google AI Studio (v1.12.2)
// @namespace    https://aistudio.google.com/prompts/
// @version      1.12.2
// @description  Tự động chạy prompt, lưu ảnh theo số thứ tự, resume đa máy, xuất JSON kết quả
// @match        https://aistudio.google.com/prompts/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    let prompts = [];
    let isRunning = false;
    let lastImageLength = null;

    const MAX_RETRIES = 3;
    const RETRY_DELAY = 15000;

    const savedResults = [];

    const STORAGE_KEYS = {
        PROMPTS: 'aiStudioPromptList',
        TEXTAREA: 'aiStudioTextareaContent'
    };

    const container = document.createElement('div');
    container.style = 'position:fixed;top:500px;right:10px;z-index:9999;background:#333;padding:10px;width:300px;border-radius:6px;color:white;font-size:13px;box-shadow:0 0 10px rgba(0,0,0,0.3)';
    const title = document.createElement('div');
    title.textContent = 'AI Studio Prompt Runner v1.12.2';
    title.style = 'margin-bottom:6px;font-weight:bold';

    const textarea = document.createElement('textarea');
    textarea.placeholder = 'Nhập mỗi prompt trên 1 dòng...';
    textarea.style = 'width:100%;height:120px;padding:5px;resize:vertical';

    const btnRow = document.createElement('div');
    btnRow.style = 'display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;';

    const buttonStart = makeBtn('▶️ Start', startRun, 'green');
    const btnExportResume = makeBtn('📤 Export Resume', exportResume);
    const btnImportResume = makeBtn('📥 Import Resume', importResume);
    const btnDownloadJson = makeBtn('💾 JSON', downloadJson, 'blue');

    const log = document.createElement('div');
    log.style = 'margin-top:10px;height:100px;overflow:auto;background:#222;padding:5px;border:1px solid #555';

    btnRow.append(buttonStart, btnExportResume, btnImportResume, btnDownloadJson);
    container.append(title, textarea, btnRow, log);
    document.body.appendChild(container);

    function makeBtn(text, fn, color) {
        const b = document.createElement('button');
        b.textContent = text;
        b.style = `padding:6px;background:${color || '#555'};color:white;border:none;border-radius:4px;cursor:pointer;flex:1`;
        b.onclick = fn;
        return b;
    }

    function logMsg(msg, color = 'white') {
        const ts = new Date().toLocaleTimeString();
        const entry = document.createElement('div');
        entry.textContent = `[${ts}] ${msg}`;
        entry.style.color = color;
        log.appendChild(entry);
        log.scrollTop = log.scrollHeight;
        console.log(msg);
    }

    function parseTextareaToPrompts() {
        const lines = textarea.value.trim().split('\n').map(l => l.trim()).filter(Boolean);
        return lines.map((text, i) => ({
            id: i + 1,
            text,
            status: 'pending',
            filename: null
        }));
    }

    function getNextPendingPrompt() {
        return prompts.find(p => p.status !== 'success');
    }

    function generateFilename(promptText, index) {
        const cleanedPrompt = promptText.replace(/\[\d+\]/g, '').trim(); // remove [number]
        const cleaned = cleanedPrompt.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '_');
        const paddedIndex = String(index + 1).padStart(3, '0');
        return `${paddedIndex}_${cleaned}.png`;
    }

    function saveGeneratedImage(prompt, img) {
        if (!img || !img.src.startsWith('data:image/')) {
            logMsg('❌ Ảnh không hợp lệ.', 'red');
            return null;
        }

        const [meta, data] = img.src.split(',');
        const mime = meta.match(/data:(image\/[^;]+);base64/)[1];
        const binary = atob(data);
        const buffer = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) buffer[i] = binary.charCodeAt(i);
        const blob = new Blob([buffer], { type: mime });
        const url = URL.createObjectURL(blob);
        const filename = generateFilename(prompt.text, prompt.id - 1);

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);

        prompt.filename = filename;
        prompt.status = 'success';
        savedResults.push({ prompt: prompt.text, filename });

        logMsg(`💾 Đã lưu ảnh: ${filename}`, 'cyan');
    }

    async function waitForGeneratedImage(timeout = 60000) {
        const interval = 500;
        const end = Date.now() + timeout;
        while (Date.now() < end) {
            const img = document.querySelector('div.image-panel-content-image img[src^="data:image/"]');
            if (img) {
                const imgLength = img.src.length;
                if (imgLength === lastImageLength) {
                    await new Promise(r => setTimeout(r, interval));
                    continue;
                } else {
                    lastImageLength = imgLength;
                    return img;
                }
            }
            await new Promise(r => setTimeout(r, interval));
        }
        return null;
    }

    async function runPrompt(prompt) {
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            const input = await waitForElement('textarea[placeholder="Describe your image"]', 5000);
            const runBtn = document.querySelector('button.run-button');
            if (!input || !runBtn) {
                logMsg(`❌ Không tìm thấy input/run (thử ${attempt})`, 'orange');
                await new Promise(r => setTimeout(r, RETRY_DELAY));
                continue;
            }

            const cleanedText = prompt.text.replace(/\[\d+\]/g, '').trim();
            input.value = cleanedText;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'a' }));
            input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'a' }));

            await new Promise(r => setTimeout(r, 2000));
            runBtn.click();

            logMsg(`🚀 Prompt #${prompt.id}: ${prompt.text.slice(0, 50)}...`, 'lightgreen');

            const img = await waitForGeneratedImage();
            if (img) {
                await new Promise(r => setTimeout(r, 4000));
                saveGeneratedImage(prompt, img);
                saveProgress();
                return true;
            }
        }

        prompt.status = 'failed';
        saveProgress();
        logMsg(`❌ Prompt lỗi #${prompt.id}`, 'red');
        return false;
    }

    async function runAllPrompts() {
        while (isRunning) {
            const next = getNextPendingPrompt();
            if (!next) {
                logMsg('✅ Hoàn tất tất cả prompt!', 'yellow');
                isRunning = false;
                buttonStart.textContent = '▶️ Start';
                break;
            }

            await runPrompt(next);
            await new Promise(r => setTimeout(r, 5000));
        }
    }

    function startRun() {
        const currentText = textarea.value.trim();
        const storedText = localStorage.getItem(STORAGE_KEYS.TEXTAREA) || '';

        if (currentText !== storedText) {
            logMsg('🆕 Nội dung prompt thay đổi → tạo mới danh sách.', 'yellow');
            prompts = parseTextareaToPrompts();
            saveProgress();
        } else if (prompts.length === 0) {
            prompts = parseTextareaToPrompts();
            saveProgress();
        }

        if (isRunning) {
            isRunning = false;
            buttonStart.textContent = '▶️ Start';
            logMsg('⏸ Đã tạm dừng.', 'orange');
        } else {
            isRunning = true;
            buttonStart.textContent = '⏹ Pause';
            runAllPrompts();
        }
    }

    function saveProgress() {
        localStorage.setItem(STORAGE_KEYS.PROMPTS, JSON.stringify(prompts));
        localStorage.setItem(STORAGE_KEYS.TEXTAREA, textarea.value);
    }

    function downloadJson() {
        const blob = new Blob([JSON.stringify(savedResults, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'ai_studio_results.json';
        link.click();
        URL.revokeObjectURL(url);
        logMsg('📦 Đã tải file kết quả', 'lightblue');
    }

    function exportResume() {
        const blob = new Blob([JSON.stringify({ prompts, textarea: textarea.value, source: 'v1.12.2' }, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'ai_studio_resume.json';
        link.click();
        URL.revokeObjectURL(url);
        logMsg('📤 Đã xuất resume', 'lightgreen');
    }

    function importResume() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        input.onchange = e => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = event => {
                try {
                    const json = JSON.parse(event.target.result);
                    prompts = json.prompts || [];
                    textarea.value = json.textarea || '';
                    logMsg(`📥 Resume đã tải (${prompts.length} prompt)`, 'cyan');
                    saveProgress();
                } catch (err) {
                    logMsg('❌ Lỗi khi import resume.', 'red');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    async function waitForElement(selector, timeout = 10000) {
        const end = Date.now() + timeout;
        while (Date.now() < end) {
            const el = document.querySelector(selector);
            if (el) return el;
            await new Promise(r => setTimeout(r, 250));
        }
        return null;
    }

    const saved = localStorage.getItem(STORAGE_KEYS.PROMPTS);
    if (saved) {
        try {
            prompts = JSON.parse(saved);
            textarea.value = localStorage.getItem(STORAGE_KEYS.TEXTAREA) || '';
            logMsg(`♻️ Resume tự động (${prompts.length} prompt)`, 'gray');
        } catch (e) {
            logMsg('⚠️ Lỗi khi đọc dữ liệu lưu.', 'orange');
        }
    }
})();
