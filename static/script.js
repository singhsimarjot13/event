/**
 * ITian Club Aptitude Quiz - Fixed Navigation & Performance
 * Resolved Next button issues, added proper Previous/Submit functionality
 */

class QuizApp {
    constructor() {
        this.currentQuestion = 1;
        this.totalQuestions = 0;
        this.answeredQuestions = new Set();
        this.isInitialized = false;
        this.eventListeners = new Map();
        
        this.init();
    }

    init() {
        if (this.isInitialized) return;
        
        this.setupEventListeners();
        this.isInitialized = true;
        
        console.log('QuizApp initialized successfully');
    }

    setupEventListeners() {
        // DOM ready event
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.onDOMReady());
        } else {
            this.onDOMReady();
        }

        // Window events
        this.addEventListener(window, 'beforeunload', (e) => {
            // Check if quiz timer is running
            if (window.quizTimer && window.quizTimer.isRunning) {
                e.preventDefault();
                e.returnValue = 'Are you sure you want to leave? Your quiz progress will be lost.';
            }
        });

        // Form submission events
        this.addEventListener(document, 'submit', (e) => {
            this.handleFormSubmission(e);
        });
    }

    addEventListener(element, event, handler) {
        element.addEventListener(event, handler);
        const key = `${event}_${Date.now()}_${Math.random()}`;
        this.eventListeners.set(key, { element, event, handler });
    }

    removeAllEventListeners() {
        this.eventListeners.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
        this.eventListeners.clear();
    }

    onDOMReady() {
        this.initializeQuiz();
        this.setupQuizNavigation();
        this.setupOptionSelection();
        this.setupFormValidation();
        this.setupLogoutHandler();
        
        console.log('DOM ready - all components initialized');
    }

    initializeQuiz() {
        const quizForm = document.getElementById('quizForm');
        if (!quizForm) return;

        this.totalQuestions = document.querySelectorAll('.question-card').length;
        
        if (this.totalQuestions > 0) {
            this.updateProgress();
            this.updateQuestionIndicators();
            this.showQuestion(1); // Show first question
        }
    }

    setupQuizNavigation() {
        const nextBtn = document.getElementById('nextBtn');
        const prevBtn = document.getElementById('prevBtn');
        const submitBtn = document.getElementById('submitBtn');
        const questionIndicators = document.querySelectorAll('.question-indicator');

        if (nextBtn) {
            this.addEventListener(nextBtn, 'click', (e) => {
                e.preventDefault();
                this.nextQuestion();
            });
        }

        if (prevBtn) {
            this.addEventListener(prevBtn, 'click', (e) => {
                e.preventDefault();
                this.prevQuestion();
            });
        }

        if (submitBtn) {
            this.addEventListener(submitBtn, 'click', (e) => {
                e.preventDefault();
                this.submitQuiz();
            });
        }

        questionIndicators.forEach(indicator => {
            this.addEventListener(indicator, 'click', (e) => {
                e.preventDefault();
                const questionNum = parseInt(e.target.dataset.question);
                this.goToQuestion(questionNum);
            });
        });
    }

    setupOptionSelection() {
        const optionInputs = document.querySelectorAll('.option-input');
        
        optionInputs.forEach(input => {
            this.addEventListener(input, 'change', (e) => {
                this.handleOptionSelection(e);
            });
        });
    }

    handleOptionSelection(event) {
        const input = event.target;
        const optionItem = input.closest('.option-item');
        const questionCard = optionItem.closest('.question-card');
        const questionIndex = parseInt(questionCard.dataset.index);

        if (input.type === 'checkbox') {
            optionItem.classList.toggle('selected', input.checked);
        } else if (input.type === 'radio') {
            // Remove selected class from all options in this question
            questionCard.querySelectorAll('.option-item').forEach(item => {
                item.classList.remove('selected');
            });
            // Add selected class to current option
            optionItem.classList.add('selected');
        }

        // Mark question as answered
        this.answeredQuestions.add(questionIndex + 1);
        this.updateQuestionIndicators();
        this.updateProgress();
    }

    nextQuestion() {
        console.log('Next clicked - Current:', this.currentQuestion, 'Total:', this.totalQuestions);
        
        if (this.currentQuestion < this.totalQuestions) {
            this.currentQuestion++;
            this.showQuestion(this.currentQuestion);
        } else {
            this.showSubmitSection();
        }
    }

    prevQuestion() {
        console.log('Previous clicked - Current:', this.currentQuestion);
        
        if (this.currentQuestion > 1) {
            this.currentQuestion--;
            this.showQuestion(this.currentQuestion);
        }
    }

    goToQuestion(questionNum) {
        console.log('Go to question:', questionNum);
        
        if (questionNum >= 1 && questionNum <= this.totalQuestions) {
            this.currentQuestion = questionNum;
            this.showQuestion(this.currentQuestion);
        }
    }

    showQuestion(questionNum) {
        console.log('Showing question:', questionNum);
        
        // Hide all question cards
        document.querySelectorAll('.question-card').forEach(card => {
            card.style.display = 'none';
        });

        // Show current question
        const currentCard = document.querySelector(`[data-index="${questionNum - 1}"]`);
        if (currentCard) {
            currentCard.style.display = 'block';
            currentCard.classList.add('fade-in');
        }

        // Update navigation buttons
        this.updateNavigationButtons(questionNum);
        
        // Update indicators and progress
        this.updateQuestionIndicators();
        this.updateProgress();
    }

    updateNavigationButtons(questionNum) {
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        const submitBtn = document.getElementById('submitBtn');
        
        if (prevBtn) {
            prevBtn.style.display = questionNum > 1 ? 'inline-block' : 'none';
        }
        
        if (nextBtn) {
            nextBtn.style.display = questionNum < this.totalQuestions ? 'inline-block' : 'none';
        }

        if (submitBtn) {
            submitBtn.style.display = questionNum === this.totalQuestions ? 'inline-block' : 'none';
        }
    }

    showSubmitSection() {
        console.log('Showing submit section');
        
        document.querySelectorAll('.question-card').forEach(card => {
            card.style.display = 'none';
        });
        
        const submitSection = document.querySelector('.submit-section');
        if (submitSection) {
            submitSection.style.display = 'block';
        }

        // Hide navigation buttons
        const nextBtn = document.getElementById('nextBtn');
        const prevBtn = document.getElementById('prevBtn');
        const submitBtn = document.getElementById('submitBtn');
        
        if (nextBtn) nextBtn.style.display = 'none';
        if (prevBtn) prevBtn.style.display = 'none';
        if (submitBtn) submitBtn.style.display = 'none';

        // Update summary stats
        this.updateSummaryStats();
    }

    submitQuiz() {
        console.log('Submitting quiz');
        
        const quizForm = document.getElementById('quizForm');
        if (!quizForm) return;

        if (this.answeredQuestions.size < this.totalQuestions) {
            const confirmed = confirm(`You have answered ${this.answeredQuestions.size} out of ${this.totalQuestions} questions. Are you sure you want to submit?`);
            if (!confirmed) {
                return false;
            }
        }
        
        // Submit the form
        quizForm.submit();
    }

    // Auto-submit functionality is now handled by quiz_timer.js

    updateProgress() {
        const progress = (this.currentQuestion / this.totalQuestions) * 100;
        const progressBar = document.getElementById('progress');
        const currentQuestionSpan = document.getElementById('currentQuestion');
        const progressPercentage = document.getElementById('progressPercentage');

        if (progressBar) {
            progressBar.style.width = progress + '%';
        }
        
        if (currentQuestionSpan) {
            currentQuestionSpan.textContent = this.currentQuestion;
        }
        
        if (progressPercentage) {
            progressPercentage.textContent = Math.round(progress);
        }
    }

    updateQuestionIndicators() {
        const indicators = document.querySelectorAll('.question-indicator');
        
        indicators.forEach((indicator, index) => {
            const questionNum = index + 1;
            indicator.classList.remove('active', 'answered');

            if (questionNum === this.currentQuestion) {
                indicator.classList.add('active');
            } else if (this.answeredQuestions.has(questionNum)) {
                indicator.classList.add('answered');
            }
        });
    }

    updateSummaryStats() {
        const answeredCount = document.getElementById('answeredCount');
        const remainingCount = document.getElementById('remainingCount');

        if (answeredCount) {
            answeredCount.textContent = this.answeredQuestions.size;
        }
        
        if (remainingCount) {
            remainingCount.textContent = this.totalQuestions - this.answeredQuestions.size;
        }
    }

    // Timer functionality is now handled by quiz_timer.js
    // This prevents conflicts between multiple timer implementations

    setupFormValidation() {
        const forms = document.querySelectorAll('.needs-validation');
        
        forms.forEach(form => {
            this.addEventListener(form, 'submit', (e) => {
                if (!form.checkValidity()) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.showAlert('Please fill in all required fields correctly.', 'danger');
                }
                
                form.classList.add('was-validated');
            });
        });
    }

    handleFormSubmission(event) {
        const form = event.target;
        
        // Quiz form validation
        if (form.id === 'quizForm') {
            if (this.answeredQuestions.size < this.totalQuestions) {
                const confirmed = confirm(`You have answered ${this.answeredQuestions.size} out of ${this.totalQuestions} questions. Are you sure you want to submit?`);
                if (!confirmed) {
                    event.preventDefault();
                    return false;
                }
            }
        }

        // Profile form validation
        if (form.classList.contains('needs-validation')) {
            const urn = document.getElementById('urn')?.value.trim();
            const crn = document.getElementById('crn')?.value.trim();
            
            if (!urn && !crn) {
                event.preventDefault();
                this.showAlert('Please provide either URN or CRN to continue.', 'danger');
                return false;
            }
        }
    }

    setupLogoutHandler() {
        const logoutLinks = document.querySelectorAll('[href*="logout"], .logout-btn');
        
        logoutLinks.forEach(link => {
            this.addEventListener(link, 'click', (e) => {
                e.preventDefault();
                this.handleLogout();
            });
        });
    }

    handleLogout() {
        const confirmed = confirm('Are you sure you want to logout?');
        if (!confirmed) return;

        // Simple redirect to logout route
        window.location.href = '/logout';
    }

    showAlert(message, type = 'info') {
        // Remove existing alerts
        const existingAlerts = document.querySelectorAll('.custom-alert');
        existingAlerts.forEach(alert => alert.remove());

        // Create new alert
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} custom-alert alert-dismissible fade show`;
        alertDiv.innerHTML = `
            <i class="fas fa-${this.getAlertIcon(type)} me-2"></i>
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        // Add styles
        alertDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            min-width: 300px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            transition: all 0.3s ease;
        `;

        // Add to page
        document.body.appendChild(alertDiv);

        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            this.dismissAlert(alertDiv);
        }, 5000);

        // Add click to dismiss
        this.addEventListener(alertDiv, 'click', () => {
            this.dismissAlert(alertDiv);
        });
    }

    dismissAlert(alertDiv) {
        alertDiv.style.opacity = '0';
        alertDiv.style.transform = 'translateY(-10px)';
        
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.parentNode.removeChild(alertDiv);
            }
        }, 300);
    }

    getAlertIcon(type) {
        const icons = {
            'success': 'check-circle',
            'danger': 'exclamation-triangle',
            'warning': 'exclamation-triangle',
            'info': 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    // Cleanup method to prevent memory leaks
    destroy() {
        this.removeAllEventListeners();
        this.isInitialized = false;
        console.log('QuizApp destroyed - memory cleaned up');
    }

    // Utility methods
    log(message, level = 'info') {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
    }

    error(message, error = null) {
        this.log(message, 'error');
        if (error) {
            console.error(error);
        }
    }
}

// Initialize the app
const quizApp = new QuizApp();

// Export for global access
window.QuizApp = quizApp;

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.QuizApp) {
        window.QuizApp.destroy();
    }
    // Also cleanup quiz timer
    if (window.quizTimer) {
        window.quizTimer.stopTimer();
    }
});
