/**
 * Quiz Timer Module
 * Handles countdown timer functionality with visual feedback and warnings
 */

class QuizTimer {
    constructor() {
        this.timerDisplay = null;
        this.quizForm = null;
        this.timeLeft = 0;
        this.totalTime = 0;
        this.endTime = 0; // epoch ms when timer should hit 0
        this.countdown = null;
        this.isRunning = false;
        this.warningThreshold = 60; // seconds
        this.criticalThreshold = 30; // seconds
        this.timeUpHandled = false;
        this.formSubmitted = false;
        this.lastRenderedSecond = null;
        this.warningShown = false;
        this.criticalShown = false;

        this.init();
    }

    init() {
        this.setupElements();
        this.startTimer();
    }

    setupElements() {
        this.timerDisplay = document.getElementById('timer');
        this.quizForm = document.getElementById('quizForm');

        if (!this.timerDisplay || !this.quizForm) {
            console.warn('Timer elements not found');
            return;
        }

        // Read timer from data attribute (in seconds)
        this.timeLeft = parseInt(this.quizForm.dataset.timer) || 300;
        this.totalTime = this.timeLeft;
        this.endTime = Date.now() + this.timeLeft * 1000;
            console.log(endTime,'this is endtime');
        console.log(`Timer initialized: ${this.timeLeft} seconds`);
    }

    startTimer() {
        if (!this.timerDisplay || this.isRunning) {
            console.log('Timer not started - display missing or already running');
            return;
        }

        this.isRunning = true;
        this.updateFromNow();

        // Use shorter tick to reduce drift and ensure smooth countdown
        this.countdown = setInterval(() => {
            try {
                this.updateFromNow();
            } catch (error) {
                console.error('Timer error:', error);
                this.stopTimer();
            }
        }, 250);

        console.log(`Timer started with ${this.timeLeft} seconds`);
    }

    updateFromNow() {
        if (!this.endTime) return;

        const now = Date.now();
        let remaining = Math.max(0, Math.floor((this.endTime - now) / 1000));


        if (this.lastRenderedSecond !== remaining) {
            this.timeLeft = remaining;
            this.updateDisplay();
            this.checkWarnings();
            this.lastRenderedSecond = remaining;

            if (this.timeLeft % 10 === 0) {
                console.log(`Timer: ${this.timeLeft} seconds remaining`);
            }
        }
        console.log("Remaining:", remaining, "TimeLeft:", this.timeLeft);

        if (remaining <= 0) {
            console.log('Timer reached 0, handling time up');
            this.handleTimeUp();
        }
    }

    updateDisplay() {
        if (!this.timerDisplay) {
            console.warn('Timer display element not found');
            return;
        }

        try {
            const minutes = Math.floor(this.timeLeft / 60);
            const seconds = this.timeLeft % 60;
            const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

            this.timerDisplay.textContent = timeString;
            this.updateProgressBar();
        } catch (error) {
            console.error('Error updating timer display:', error);
        }
    }

    updateProgressBar() {
        const timerProgress = document.getElementById('timerProgress');
        if (!timerProgress) return;

        const progressPercent = ((this.totalTime - this.timeLeft) / this.totalTime) * 100;
        timerProgress.style.width = progressPercent + '%';
    }
checkWarnings() {
    if (!this.timerDisplay) return;

    // Warning once (<= 60s)
    if (this.timeLeft <= this.warningThreshold && !this.warningShown) {
        this.warningShown = true;
        this.timerDisplay.style.color = '#fd7e14';
        this.timerDisplay.style.fontWeight = 'bold';
        this.showWarning('Warning: Less than 1 minute remaining!', 'warning');
    }

    // Critical once (<= 30s)
    if (this.timeLeft <= this.criticalThreshold && !this.criticalShown) {
        this.criticalShown = true;
        this.timerDisplay.style.color = '#dc3545';
        this.timerDisplay.style.fontWeight = 'bold';
        this.addPulseAnimation();
        this.showWarning('Critical: Less than 30 seconds remaining!', 'danger');
    }
}



    addPulseAnimation() {
        if (!this.timerDisplay) return;

        this.timerDisplay.style.animation = 'pulse 1s infinite';

        if (!document.getElementById('timer-pulse-style')) {
            const style = document.createElement('style');
            style.id = 'timer-pulse-style';
            style.textContent = `
                @keyframes pulse {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.1); }
                    100% { transform: scale(1); }
                }
            `;
            document.head.appendChild(style);
        }
    }

    showWarning(message, type) {
        if (this.timeLeft === this.warningThreshold || this.timeLeft === this.criticalThreshold) {
            if (window.QuizApp && window.QuizApp.showAlert) {
                window.QuizApp.showAlert(message, type);
            } else {
                const alertDiv = document.createElement('div');
                alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
                alertDiv.style.cssText = `
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 9999;
                    min-width: 300px;
                `;
                alertDiv.innerHTML = `
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    ${message}
                    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                `;
                document.body.appendChild(alertDiv);

                setTimeout(() => {
                    alertDiv.remove();
                }, 3000);
            }
        }
    }

    handleTimeUp() {
        if (this.timeUpHandled) return;
        this.timeUpHandled = true;

        this.stopTimer();
        this.showWarning('Time is up! Quiz will be submitted automatically.', 'danger');

        setTimeout(() => {
            if (this.quizForm && !this.formSubmitted) {
                this.formSubmitted = true;
                console.log('Auto-submitting quiz due to time up');

                const timeUpInput = document.createElement('input');
                timeUpInput.type = 'hidden';
                timeUpInput.name = 'time_up';
                timeUpInput.value = 'true';
                this.quizForm.appendChild(timeUpInput);

                this.quizForm.submit();
            }
        }, 2000);
    }

    stopTimer() {
        if (this.countdown) {
            clearInterval(this.countdown);
            this.countdown = null;
            this.isRunning = false;
            console.log('Timer stopped');
        }
        this.endTime = 0;
        this.lastRenderedSecond = null;
    }

    pauseTimer() {
        if (this.isRunning) {
            this.updateFromNow();
            if (this.countdown) {
                clearInterval(this.countdown);
                this.countdown = null;
            }
            this.isRunning = false;
            console.log('Timer paused');
        }
    }

    resumeTimer() {
        if (!this.isRunning && this.timeLeft > 0) {
            this.endTime = Date.now() + this.timeLeft * 1000;
            this.startTimer();
            console.log('Timer resumed');
        }
    }

    getTimeLeft() {
        return this.timeLeft;
    }

    getTimeElapsed() {
        return this.totalTime - this.timeLeft;
    }

    getProgressPercentage() {
        return ((this.totalTime - this.timeLeft) / this.totalTime) * 100;
    }

    isTimerRunning() {
        return this.isRunning;
    }

    addTime(seconds) {
        if (seconds > 0) {
            this.timeLeft += seconds;
            this.totalTime += seconds;
            this.endTime = Date.now() + this.timeLeft * 1000; // ✅ SYNC FIX
            this.updateDisplay();
            console.log(`Added ${seconds} seconds to timer`);
        }
    }

    setTime(seconds) {
        if (seconds > 0) {
            this.timeLeft = seconds;
            this.totalTime = seconds;
            this.endTime = Date.now() + this.timeLeft * 1000; // ✅ SYNC FIX
            this.updateDisplay();
            console.log(`Timer set to ${seconds} seconds`);
        }
    }
}

// Initialize timer when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('timer') && document.getElementById('quizForm') && !window.quizTimer) {
        window.quizTimer = new QuizTimer();
        console.log('Quiz timer initialized');
    } else if (window.quizTimer) {
        console.log('Quiz timer already exists, skipping initialization');
    } else {
        console.log('Not on quiz page, timer not initialized');
    }
});

window.QuizTimer = QuizTimer;
