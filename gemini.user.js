// ==UserScript==
// @name         Gemini Stop Button Handler
// @namespace    http://tampermonkey.net/
// @version      1.5
// @description  Add a toggle button to enable/disable detection of stop button disappearance on gemini.google.com, simulate typing "TIẾP TỤC" and press Enter on toggle activation and when stop button disappears, stop after 10 executions
// @author       Grok
// @match        https://gemini.google.com/gem/*
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
    let stopButtonExists = false; // Theo dõi trạng thái nút dừng

    // Hàm mô phỏng phím Enter
    function simulateEnterKey(textarea) {
        const enterEvent = new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            bubbles: true,
            cancelable: true
        });
        if (textarea) {
            textarea.dispatchEvent(enterEvent);
            console.log('Đã mô phỏng nhấn Enter');
        } else {
            console.error('Không tìm thấy ô nhập liệu Gemini để mô phỏng Enter');
        }
    }

    // Hàm giả lập gõ văn bản vào ô nhập liệu của Gemini
    function simulateTyping(text, retryCount = 3, retryDelay = 500) {
        const geminiTextarea = document.querySelector('div[aria-label="Nhập câu lệnh tại đây"].ql-editor');
        if (geminiTextarea) {
            geminiTextarea.focus();
            document.execCommand('insertText', false, text);
            console.log('Đã giả lập gõ văn bản vào ô nhập liệu Gemini:', text);

            // Mô phỏng nhấn Enter
            setTimeout(() => {
                simulateEnterKey(geminiTextarea);
            }, 300); // Độ trễ 300ms
        } else if (retryCount > 0) {
            console.log(`Không tìm thấy ô nhập liệu Gemini, thử lại sau ${retryDelay}ms (lần ${4 - retryCount}/3)`);
            setTimeout(() => {
                simulateTyping(text, retryCount - 1, retryDelay);
            }, retryDelay);
        } else {
            console.error('Không tìm thấy ô nhập liệu Gemini sau khi thử lại');
        }
    }

    // Hàm xử lý khi nút dừng biến mất
    function handleStopButtonDisappear() {
        const now = Date.now();
        if (now - lastProcessed < PROCESS_COOLDOWN) {
            console.log('Bỏ qua xử lý vì còn trong thời gian cooldown');
            return;
        }
        if (executionCount >= MAX_EXECUTIONS) {
            console.log('Đã đạt giới hạn 10 lần thực thi, dừng script');
            toggleObserver(false); // Tắt observer
            return;
        }

        lastProcessed = now;
        executionCount++;
        console.log(`Thực thi lần ${executionCount}/${MAX_EXECUTIONS}`);

        simulateTyping('TIẾP TỤC');
    }

    // Hàm bật/tắt observer
    function toggleObserver(activate) {
        if (activate && !isActive) {
            isActive = true;

            // Gõ "TIẾP TỤC" ngay khi bật toggle
            if (executionCount < MAX_EXECUTIONS) {
                console.log('Gõ "TIẾP TỤC" ngay khi bật tính năng');
                simulateTyping('TIẾP TỤC');
            }

            observer = new MutationObserver((mutations) => {
                const stopButton = document.querySelector('button[aria-label="Ngừng tạo câu trả lời"][class*="stop"]');
                const currentStopButtonExists = !!stopButton;

                // Kiểm tra nếu nút dừng biến mất (từ tồn tại sang không tồn tại)
                if (stopButtonExists && !currentStopButtonExists && executionCount < MAX_EXECUTIONS) {
                    console.log('MutationObserver phát hiện nút "Ngừng tạo câu trả lời" đã biến mất');
                    handleStopButtonDisappear();
                }

                // Cập nhật trạng thái nút
                stopButtonExists = currentStopButtonExists;
            });
            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['class', 'aria-label']
            });
            console.log('Đã bật tính năng theo dõi');
            toggleButton.textContent = 'Tắt Tính Năng';
            toggleButton.style.backgroundColor = '#28a745';

            // Kiểm tra trạng thái ban đầu của nút dừng
            const initial = document.querySelector('button[aria-label="Ngừng tạo câu trả lời"][class*="stop"]');
            stopButtonExists = !!initial;
            console.log('Trạng thái ban đầu của nút dừng:', stopButtonExists ? 'Tồn tại' : 'Không tồn tại');
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
