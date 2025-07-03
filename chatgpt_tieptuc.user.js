// ==UserScript==
// @name         Speech Button Handler V5
// @namespace    http://tampermonkey.net/
// @version      1.5
// @description  Add a toggle button to enable/disable continuous detection of speech button container on chatgpt.com, simulate Shift+Esc, paste "TIẾP TỤC", press Enter, stop after 7 executions
// @author       Grok
// @match        https://chatgpt.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Biến trạng thái
    let executionCount = 0;
    const MAX_EXECUTIONS = 10;
    let lastProcessed = 0;
    const PROCESS_COOLDOWN = 1000; // Đợi 1 giây giữa các lần xử lý
    let isActive = false;
    let observer = null;

    // Hàm mô phỏng phím Shift + Esc
    function simulateShiftEsc() {
        const shiftEscEvent = new KeyboardEvent('keydown', {
            key: 'Escape',
            code: 'Escape',
            shiftKey: true,
            bubbles: true,
            cancelable: true
        });
        document.dispatchEvent(shiftEscEvent);
        console.log('Đã mô phỏng Shift + Esc');
    }

    // Hàm mô phỏng phím Enter
    function simulateEnterKey() {
        const enterEvent = new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            bubbles: true,
            cancelable: true
        });
        const chatGptTextarea = document.querySelector('#prompt-textarea.ProseMirror');
        if (chatGptTextarea) {
            chatGptTextarea.dispatchEvent(enterEvent);
            console.log('Đã mô phỏng nhấn Enter');
        } else {
            console.error('Không tìm thấy ô nhập liệu ChatGPT để mô phỏng Enter');
        }
    }

    // Hàm dán nội dung trực tiếp vào ô nhập liệu của ChatGPT
    function pasteToChatGptTextarea(text) {
        const chatGptTextarea = document.querySelector('#prompt-textarea.ProseMirror');
        if (chatGptTextarea) {
            chatGptTextarea.innerText = text;
            const inputEvent = new Event('input', { bubbles: true });
            chatGptTextarea.dispatchEvent(inputEvent);
            console.log('Đã dán nội dung vào ô nhập liệu ChatGPT:', text);

            // Mô phỏng nhấn Enter
            setTimeout(() => {
                simulateEnterKey();
            }, 300); // Độ trễ 300ms
        } else {
            console.error('Không tìm thấy ô nhập liệu ChatGPT');
        }
    }

    // Hàm xử lý khi phát hiện nút
    function handleSpeechButton() {
        const now = Date.now();
        if (now - lastProcessed < PROCESS_COOLDOWN) {
            console.log('Bỏ qua xử lý vì còn trong thời gian cooldown');
            return;
        }
        if (executionCount >= MAX_EXECUTIONS) {
            console.log('Đã đạt giới hạn 7 lần thực thi, dừng script');
            toggleObserver(false); // Tắt observer
            return;
        }

        lastProcessed = now;
        executionCount++;
        console.log(`Thực thi lần ${executionCount}/${MAX_EXECUTIONS}`);

        simulateShiftEsc();
        pasteToChatGptTextarea('TIẾP TỤC');
    }

    // Hàm bật/tắt observer
    function toggleObserver(activate) {
        if (activate && !isActive) {
            isActive = true;
            observer = new MutationObserver((mutations) => {
                const speechButtonContainer = document.querySelector('[data-testid="composer-speech-button-container"]');
                if (speechButtonContainer && executionCount < MAX_EXECUTIONS) {
                    console.log('MutationObserver phát hiện container nút thoại');
                    handleSpeechButton();
                }
            });
            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: false
            });
            console.log('Đã bật tính năng theo dõi');
            toggleButton.textContent = 'Tắt Tính Năng';
            toggleButton.style.backgroundColor = '#28a745';
        } else if (!activate && isActive) {
            isActive = false;
            if (observer) {
                observer.disconnect();
                observer = null;
            }
            console.log('Đã tắt tính năng theo dõi');
            toggleButton.textContent = 'Bật Tính Năng';
            toggleButton.style.backgroundColor = '#dc3545';
        }
    }

    // Tạo nút toggle
    const toggleButton = document.createElement('button');
    toggleButton.textContent = 'Bật Tính Năng';
    toggleButton.style.position = 'fixed';
    toggleButton.style.top = '60px';
    toggleButton.style.right = '10px';
    toggleButton.style.zIndex = '9999';
    toggleButton.style.padding = '10px 15px';
    toggleButton.style.backgroundColor = '#dc3545';
    toggleButton.style.color = '#fff';
    toggleButton.style.border = 'none';
    toggleButton.style.borderRadius = '5px';
    toggleButton.style.cursor = 'pointer';
    toggleButton.style.fontSize = '14px';

    // Thêm sự kiện click cho nút
    toggleButton.addEventListener('click', () => {
        toggleObserver(!isActive);
    });

    // Thêm nút vào trang
    document.body.appendChild(toggleButton);

    // Kiểm tra ban đầu
    console.log('Nút toggle đã được thêm vào trang. Nhấn để kích hoạt tính năng.');
})();
