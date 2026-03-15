/**
 * EdTech Quiz Logic Controller
 * Handles parsing, UI rendering, timer, and result analytics.
 */

document.addEventListener("DOMContentLoaded", () => {
    // --- STATE VARIABLES ---
    let questions = [];
    let startTime = null;
    let timerInterval = null;

    // --- DOM ELEMENTS ---
    const loadingSection = document.getElementById('loading-section');
    const quizSection = document.getElementById('quiz-section');
    const resultSection = document.getElementById('result-section');
    const questionsContainer = document.getElementById('questions-container');
    const quizForm = document.getElementById('quiz-form');
    const timerDisplay = document.getElementById('timer-display');
    const timeSpan = timerDisplay.querySelector('span');
    const reviewContainer = document.getElementById('review-container');

    // --- INITIALIZATION ---
    init();

    async function init() {
        try {
            const rawData = await fetchQuizData('data.txt');
            questions = parseData(rawData);
            startQuiz();
        } catch (error) {
            loadingSection.innerHTML = `<p style="color:red;">Lỗi tải dữ liệu: ${error.message}. Vui lòng chạy ứng dụng qua một Web Server (Live Server).</p>`;
        }
    }

    async function fetchQuizData(url) {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.text();
    }

    /**
     * Parses the `.txt` string into an array of structured objects.
     */
    function parseData(text) {
        const lines = text.split('\n');
        const parsedQuestions = [];
        let currentQ = null;

        lines.forEach(line => {
            line = line.trim();
            if (!line) return;

            // Match Question
            let qMatch = line.match(/^Ask\d+:\s*(.*)/i);
            if (qMatch) {
                if (currentQ) parsedQuestions.push(currentQ);
                currentQ = {
                    questionText: qMatch[1],
                    options: [],
                    key: null,
                    type: 'single' // Default to single choice
                };
                return;
            }

            // Match Answer options
            let aMatch = line.match(/^answer\d+:\s*(.*)/i);
            if (aMatch && currentQ) {
                currentQ.options.push(aMatch[1]);
                return;
            }

            // Match Key
            let kMatch = line.match(/^Key:\s*(.*)/i);
            if (kMatch && currentQ) {
                const keyStr = kMatch[1];
                if (keyStr.includes(',')) {
                    currentQ.type = 'multi';
                    currentQ.key = keyStr.split(',').map(Number);
                } else {
                    currentQ.type = 'single';
                    currentQ.key = parseInt(keyStr, 10);
                }
            }
        });

        if (currentQ) parsedQuestions.push(currentQ);
        return parsedQuestions;
    }

    // --- UI RENDERING & QUIZ LOGIC ---

    function startQuiz() {
        renderQuestions();
        loadingSection.classList.add('hidden');
        resultSection.classList.add('hidden');
        quizSection.classList.remove('hidden');
        
        // Reset form & Timer
        quizForm.reset();
        startTime = Date.now();
        timerDisplay.classList.remove('hidden');
        clearInterval(timerInterval);
        timerInterval = setInterval(updateTimer, 1000);
        updateTimer();
    }

    function renderQuestions() {
        questionsContainer.innerHTML = '';
        const fragment = document.createDocumentFragment();

        questions.forEach((q, qIndex) => {
            const block = document.createElement('div');
            block.className = 'question-block';

            const title = document.createElement('div');
            title.className = 'question-text';
            title.textContent = `Câu ${qIndex + 1}: ${q.questionText}`;
            if (q.type === 'multi') {
                title.textContent += ' (Có thể chọn nhiều đáp án)';
            }
            block.appendChild(title);

            const optionsGroup = document.createElement('div');
            optionsGroup.className = 'options-group';

            q.options.forEach((optText, optIndex) => {
                const label = document.createElement('label');
                label.className = 'option-label';

                const input = document.createElement('input');
                // Use 'radio' for single, 'checkbox' for multi
                input.type = q.type === 'single' ? 'radio' : 'checkbox';
                input.name = `question_${qIndex}`;
                input.value = optIndex + 1;

                label.appendChild(input);
                label.appendChild(document.createTextNode(` ${optText}`));
                optionsGroup.appendChild(label);
            });

            block.appendChild(optionsGroup);
            fragment.appendChild(block);
        });

        questionsContainer.appendChild(fragment);
    }

    function updateTimer() {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
        const s = String(elapsed % 60).padStart(2, '0');
        timeSpan.textContent = `${m}:${s}`;
    }

    // --- SUBMISSION & RESULT CALCULATION ---

    quizForm.addEventListener('submit', (e) => {
        e.preventDefault();
        clearInterval(timerInterval);
        timerDisplay.classList.add('hidden');
        
        const timeTakenMs = Date.now() - startTime;
        evaluateResults(timeTakenMs);
    });

    function evaluateResults(timeTakenMs) {
        let correctCount = 0;
        const formData = new FormData(quizForm);
        reviewContainer.innerHTML = '';
        const reviewFragment = document.createDocumentFragment();

        questions.forEach((q, qIndex) => {
            const isCorrect = checkAnswer(q, qIndex, formData);
            if (isCorrect) correctCount++;
            
            // Build detailed review snippet
            const reviewItem = buildReviewItem(q, qIndex, isCorrect, formData);
            reviewFragment.appendChild(reviewItem);
        });

        reviewContainer.appendChild(reviewFragment);

        // Update Stats UI
        const accuracy = Math.round((correctCount / questions.length) * 100);
        const m = String(Math.floor(timeTakenMs / 60000)).padStart(2, '0');
        const s = String(Math.floor((timeTakenMs % 60000) / 1000)).padStart(2, '0');

        document.getElementById('score-display').textContent = `${correctCount}/${questions.length}`;
        document.getElementById('accuracy-display').textContent = `${accuracy}%`;
        document.getElementById('time-display').textContent = `${m}:${s}`;

        quizSection.classList.add('hidden');
        resultSection.classList.remove('hidden');
    }

    function checkAnswer(q, qIndex, formData) {
        if (q.type === 'single') {
            const selected = formData.get(`question_${qIndex}`);
            return selected && parseInt(selected, 10) === q.key;
        } else {
            // Multi-choice: Check if selected boxes match the binary array
            const selectedArr = formData.getAll(`question_${qIndex}`).map(Number);
            let isMatch = true;
            q.key.forEach((val, idx) => {
                const optValue = idx + 1;
                const isSelected = selectedArr.includes(optValue);
                const shouldBeSelected = val === 1;
                if (isSelected !== shouldBeSelected) {
                    isMatch = false;
                }
            });
            return isMatch;
        }
    }

    function buildReviewItem(q, qIndex, isCorrect, formData) {
        const div = document.createElement('div');
        div.className = `review-item ${isCorrect ? 'review-correct' : 'review-incorrect'}`;
        
        const title = document.createElement('h4');
        title.textContent = `Câu ${qIndex + 1}: ${q.questionText}`;
        div.appendChild(title);

        const feedback = document.createElement('p');
        feedback.className = `feedback-text ${isCorrect ? 'feedback-correct' : 'feedback-incorrect'}`;
        feedback.textContent = isCorrect ? '✓ Chính xác' : '✗ Chưa chính xác';
        div.appendChild(feedback);

        // Show correct answers based on type
        const correctInfo = document.createElement('p');
        correctInfo.style.marginTop = '10px';
        correctInfo.style.fontSize = '0.9rem';
        
        if (q.type === 'single') {
            correctInfo.textContent = `Đáp án đúng: ${q.options[q.key - 1]}`;
        } else {
            const correctOpts = q.key.map((val, idx) => val === 1 ? q.options[idx] : null).filter(v => v !== null);
            correctInfo.textContent = `Đáp án đúng: ${correctOpts.join(', ')}`;
        }
        div.appendChild(correctInfo);

        return div;
    }

    // --- RETAKE LOGIC ---
    document.getElementById('retake-btn').addEventListener('click', () => {
        startQuiz();
    });
});


