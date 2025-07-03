// ==UserScript==
// @name         Auto Continuous Prompt Generator for CapCut Dreamina (v1.6)
// @namespace    https://dreamina.capcut.com/
// @version      1.6
// @description  Tự động nhập prompt, nhấn Generate, xử lý lỗi, tương thích UI mới CapCut Dreamina (07/2025), vượt kiểm tra DOM nội bộ
// @match        https://dreamina.capcut.com/ai-tool/generate
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    let prompts = [];
    let INTERVAL_TIME = 5000;
    const RETRY_DELAY = 20000;
    const LIMIT_ERROR_DELAY = 60000;
    const MAX_RETRIES = 3;

    let currentPromptIndex = 0;
    let isPaused = false;
    let isRunning = false;
    let isLocked = false;

    function createUI() {
        const container = document.createElement('div');
        container.style = 'position:fixed;top:250px;right:10px;z-index:9999;background:#515151;padding:10px;border-radius:5px;width:300px;box-shadow:0 0 10px rgba(0,0,0,0.2)';

        const header = document.createElement('div');
        header.style = 'display:flex;justify-content:space-between;align-items:center;background:#333;color:white;padding:5px;margin-bottom:10px';

        const title = document.createElement('span');
        title.textContent = 'Prompt Generator';

        const toggle = document.createElement('button');
        toggle.textContent = '−';
        toggle.style = 'background:transparent;color:white;border:none;cursor:pointer;font-size:16px';

        header.append(title, toggle);

        const textarea = document.createElement('textarea');
        textarea.placeholder = 'Nhập prompt mỗi dòng...';
        textarea.style = 'width:100%;height:120px;margin-bottom:10px;padding:5px;resize:vertical';
        textarea.id = 'promptTextarea';

        const control = document.createElement('button');
        control.textContent = 'Start';
        control.style = 'padding:10px 20px;background:#4CAF50;color:white;border:none;border-radius:5px;cursor:pointer;width:100%';
        control.id = 'controlButton';

        const timer = document.createElement('div');
        timer.id = 'retryTimer';
        timer.style = 'margin-top:5px;text-align:center;color:#fff;display:none';

        const log = document.createElement('div');
        log.id = 'logContainer';
        log.style = 'margin-top:10px;background:#404040;color:white;font-size:12px;height:100px;overflow-y:auto;padding:5px;border:1px solid #ccc;line-height:1.2';

        container.append(header, textarea, control, timer, log);
        document.body.appendChild(container);

        toggle.addEventListener('click', () => {
            const collapsed = textarea.style.display === 'none';
            textarea.style.display = collapsed ? 'block' : 'none';
            control.style.display = collapsed ? 'block' : 'none';
            log.style.display = collapsed ? 'block' : 'none';
            toggle.textContent = collapsed ? '−' : '+';
        });

        return { textarea, control, timer, log };
    }

    const { textarea, control: controlButton, timer: retryTimer, log: logDiv } = createUI();

    function logMsg(msg, color) {
        const ts = new Date().toLocaleTimeString();
        const entry = document.createElement('div');
        entry.textContent = `[${ts}] ${msg}`;
        if (color) entry.style.color = color;
        logDiv.appendChild(entry);
        logDiv.scrollTop = logDiv.scrollHeight;
        console.log(msg);
    }

    function startCountdown(ms) {
        let sec = ms / 1000;
        retryTimer.style.display = 'block';
        retryTimer.textContent = `Chờ: ${sec} giây`;
        const intv = setInterval(() => {
            sec--;
            retryTimer.textContent = `Chờ: ${sec} giây`;
            if (sec <= 0) {
                clearInterval(intv);
                retryTimer.style.display = 'none';
            }
        }, 1000);
        return intv;
    }

    function parsePrompts() {
        const lines = textarea.value.trim().split('\n').map(t => t.trim()).filter(Boolean);
        if (lines.length === 0) {
            logMsg('⚠️ Vui lòng nhập ít nhất một prompt!');
            return false;
        }
        prompts = lines.map((text, i) => ({ id: i + 1, text, status: 'pending' }));
        currentPromptIndex = 0;
        localStorage.setItem('capcutPrompts', JSON.stringify(prompts));
        localStorage.setItem('capcutTextareaContent', textarea.value);
        localStorage.setItem('capcutCurrentPromptIndex', currentPromptIndex);
        logMsg(`✅ Đã tải ${prompts.length} prompt.`);
        return true;
    }

    function loadFromStorage() {
        const saved = localStorage.getItem('capcutPrompts');
        const text = localStorage.getItem('capcutTextareaContent');
        const idx = localStorage.getItem('capcutCurrentPromptIndex');
        if (saved) prompts = JSON.parse(saved);
        if (text) textarea.value = text;
        if (idx) currentPromptIndex = parseInt(idx, 10);
    }

    async function waitForElement(selector, timeout = 5000) {
        return new Promise(resolve => {
            const found = document.querySelector(selector);
            if (found) return resolve(found);
            const observer = new MutationObserver(() => {
                const el = document.querySelector(selector);
                if (el) {
                    observer.disconnect();
                    resolve(el);
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
            setTimeout(() => {
                observer.disconnect();
                resolve(null);
            }, timeout);
        });
    }

    function checkTooManyAttempts() {
        const toast = document.querySelector('.lv-message.lv-message-warning .lv-message-content');
        return toast && toast.textContent.includes('Too many attempts');
    }

    function checkNotEnoughCredits() {
        const modal = document.querySelector('.lv-modal-content .title-Fw9fNb');
        return modal && modal.textContent.includes('Not enough credits');
    }

    async function generateSinglePrompt(prompt) {
        const textarea = await waitForElement('textarea.prompt-textarea-ayI_oJ');
        const inputMirror = document.querySelector('input.prompt-input-Ey9I98');
        const placeholder = document.querySelector('.prompt-textarea-layout-placeholder-erJllw');

        if (!textarea) {
            logMsg('⚠️ Không tìm thấy textarea!');
            return false;
        }

        const text = prompt.text;

        // Gõ prompt
        textarea.value = text;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));

        if (inputMirror) {
            inputMirror.value = text;
            inputMirror.dispatchEvent(new Event('input', { bubbles: true }));
        }

        if (placeholder) {
            placeholder.textContent = text;
        }

        // Kích hoạt sự kiện bàn phím mô phỏng người dùng gõ
        textarea.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'a' }));
        textarea.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'a' }));
        textarea.dispatchEvent(new Event('compositionend', { bubbles: true }));

        // ✅ Quan trọng: đợi để giao diện xử lý việc hiện nút
        await new Promise(r => setTimeout(r, 500));

        // Bây giờ mới kiểm tra và click nút generate
        const button = document.querySelector('button.submit-button-bPnDkw');

        if (!button || button.disabled || button.classList.contains('lv-btn-disabled')) {
            logMsg('⚠️ Nút Generate chưa sẵn sàng sau khi nhập prompt!');
            return false;
        }

        logMsg(`🚀 Prompt #${prompt.id}: ${text.slice(0, 50)}...`);

        return new Promise(resolve => {
            setTimeout(() => {
                button.click();
                resolve(true);
            }, 500);
        });
    }


    async function processPrompt(prompt) {
        let retry = 0;
        while (isRunning) {
            if (isLocked) {
                await new Promise(r => setTimeout(r, RETRY_DELAY));
                continue;
            }
            if (isPaused) {
                isLocked = true;
                startCountdown(LIMIT_ERROR_DELAY);
                await new Promise(r => setTimeout(r, LIMIT_ERROR_DELAY));
                isLocked = false;
                continue;
            }

            const ok = await generateSinglePrompt(prompt);
            await new Promise(r => setTimeout(r, 2000));

            if (ok && !isPaused) {
                prompt.status = 'success';
                localStorage.setItem('capcutPrompts', JSON.stringify(prompts));
                return true;
            } else {
                retry++;
                prompt.status = 'failed';
                localStorage.setItem('capcutPrompts', JSON.stringify(prompts));
                if (retry >= MAX_RETRIES && !checkTooManyAttempts() && !checkNotEnoughCredits()) {
                    logMsg(`❌ Prompt #${prompt.id} thất bại sau ${MAX_RETRIES} lần.`);
                    return false;
                }
                isLocked = true;
                const delay = checkTooManyAttempts() ? LIMIT_ERROR_DELAY : RETRY_DELAY;
                startCountdown(delay);
                await new Promise(r => setTimeout(r, delay));
                isLocked = false;
            }
        }
        return false;
    }

    async function processPromptQueue() {
        while (currentPromptIndex < prompts.length && isRunning && !isLocked) {
            const prompt = prompts[currentPromptIndex];
            if (prompt.status === 'pending' || prompt.status === 'failed') {
                const ok = await processPrompt(prompt);
                if (ok) {
                    currentPromptIndex++;
                    INTERVAL_TIME = 5000;
                    localStorage.setItem('capcutCurrentPromptIndex', currentPromptIndex);
                    await new Promise(r => setTimeout(r, INTERVAL_TIME));
                } else {
                    logMsg(`⏸ Dừng tại prompt #${prompt.id}`, 'orange');
                    return;
                }
            } else {
                currentPromptIndex++;
            }
        }
        if (currentPromptIndex >= prompts.length) {
            logMsg('✅ Hoàn thành tất cả prompt!', 'red');
            controlButton.textContent = 'Start';
            isRunning = false;
        }
    }

    controlButton.addEventListener('click', () => {
        if (isLocked) return logMsg('🔒 Script đang khóa!');
        if (!isRunning) {
            if (prompts.length === 0 || textarea.value !== localStorage.getItem('capcutTextareaContent')) {
                if (!parsePrompts()) return;
            }
            isRunning = true;
            controlButton.textContent = 'Pause';
            processPromptQueue();
        } else if (controlButton.textContent === 'Pause') {
            isRunning = false;
            controlButton.textContent = 'Resume';
            localStorage.setItem('capcutCurrentPromptIndex', currentPromptIndex);
        } else {
            isRunning = true;
            controlButton.textContent = 'Pause';
            processPromptQueue();
        }
    });

    window.addEventListener('load', () => {
        loadFromStorage();
        const observer = new MutationObserver(() => {
            if (checkTooManyAttempts()) isPaused = true;
            else if (checkNotEnoughCredits()) {
                isRunning = false;
                isLocked = false;
                isPaused = false;
                controlButton.textContent = 'Start';
                logMsg('🛑 Hết credit, dừng lại!', 'red');
            } else if (isPaused && !checkTooManyAttempts()) {
                isPaused = false;
                if (isRunning && !isLocked) processPromptQueue();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    });
})();
