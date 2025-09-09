from flask import Flask, redirect, url_for, session, render_template, request, flash, jsonify, abort
from flask_dance.contrib.google import make_google_blueprint, google
from flask_sqlalchemy import SQLAlchemy
from flask_session import Session
import random
import logging
from datetime import datetime, timedelta
from flask_mail import Message, Mail
from apscheduler.schedulers.background import BackgroundScheduler
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Configuration
app.config.update(
    SECRET_KEY=os.environ.get('SECRET_KEY', "waheguruji111!!!@"),
    SESSION_TYPE="filesystem",
    SQLALCHEMY_DATABASE_URI="sqlite:///participants.db",
    SQLALCHEMY_TRACK_MODIFICATIONS=False,
    MAIL_SERVER='smtp.gmail.com',
    MAIL_PORT=587,
    MAIL_USE_TLS=True,
    MAIL_USERNAME=os.environ.get('MAIL_USERNAME', 'your-email@gmail.com'),
    MAIL_PASSWORD=os.environ.get('MAIL_PASSWORD', 'your-app-password'),
    MAIL_DEFAULT_SENDER=os.environ.get('MAIL_DEFAULT_SENDER', 'itianclub@gmail.com')
)

# Initialize extensions
Session(app)
db = SQLAlchemy(app)
mail = Mail(app)

# Google OAuth Configuration
google_bp = make_google_blueprint(
    client_id=os.environ.get('GOOGLE_CLIENT_ID', "169682567720-e500ldm2164qij7bse64krq1lvru5e5v.apps.googleusercontent.com"),
    client_secret=os.environ.get('GOOGLE_CLIENT_SECRET', "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"),
    scope=[
        "openid",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile"
    ],
    redirect_to="google_login"
)
app.register_blueprint(google_bp, url_prefix="/login")

# Database Model
class Participant(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    google_id = db.Column(db.String(150), unique=True)
    name = db.Column(db.String(150))
    email = db.Column(db.String(150), unique=True)
    profile_pic = db.Column(db.String(300))
    urn = db.Column(db.String(50), nullable=True)
    crn = db.Column(db.String(50), nullable=True)
    branch = db.Column(db.String(50))
    year = db.Column(db.Integer)
    quiz_submitted = db.Column(db.Boolean, default=False)
    score = db.Column(db.Integer, default=0)
    answers = db.Column(db.JSON, nullable=True)
    questions = db.Column(db.JSON, nullable=True)  # Store the questions that were asked
    category_scores = db.Column(db.JSON, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# Create database tables
with app.app_context():
    db.create_all()

# Background scheduler for email tasks
scheduler = BackgroundScheduler()
scheduler.start()

# Helper Functions
def is_authenticated():
    """Check if user is authenticated"""
    return 'user_email' in session

def is_admin():
    """Check if current user is admin"""
    admin_emails = ["thoughtz175@gmail.com"]  # Add more admin emails as needed
    return session.get("user_email") in admin_emails

def require_auth(f):
    """Decorator to require authentication"""
    def decorated_function(*args, **kwargs):
        if not is_authenticated():
            flash("Please login to access this page.", "warning")
            return redirect(url_for("index"))
        return f(*args, **kwargs)
    decorated_function.__name__ = f.__name__
    return decorated_function

def require_admin(f):
    """Decorator to require admin access"""
    def decorated_function(*args, **kwargs):
        if not is_authenticated():
            flash("Please login to access this page.", "warning")
            return redirect(url_for("index"))
        if not is_admin():
            flash("Access denied. Admin privileges required.", "danger")
            return redirect(url_for("index"))
        return f(*args, **kwargs)
    decorated_function.__name__ = f.__name__
    return decorated_function

def get_participant():
    """Get current participant from database"""
    if not is_authenticated():
        return None
    return Participant.query.filter_by(email=session["user_email"]).first()

# Routes
@app.route("/")
def index():
    """Home page"""
    # Clear any old flash messages
    session.pop('_flashes', None)
    return render_template("index.html")

@app.route("/google_login")
def google_login():
    """Handle Google OAuth login"""
    try:
        if not google.authorized:
            return redirect(url_for("google.login"))

        resp = google.get("/oauth2/v2/userinfo")
        if not resp.ok:
            flash("Failed to authenticate with Google. Please try again.", "danger")
            return redirect(url_for("index"))

        user_info = resp.json()
        
        # Store user info in session
        session["user_email"] = user_info["email"]
        session["user_name"] = user_info["name"]
        session["user_picture"] = user_info.get("picture")
        session["google_id"] = user_info["id"]

        # Check if participant already exists
        participant = Participant.query.filter_by(email=user_info["email"]).first()
        
        if participant:
            if participant.quiz_submitted:
                flash(f"Welcome back, {participant.name}! You have already completed the quiz.", "info")
                return redirect(url_for('thank_you'))
            else:
                flash(f"Welcome back, {participant.name}! Please complete your profile.", "info")
                return redirect(url_for("profile_form"))
        else:
            flash(f"Welcome, {user_info['name']}! Please complete your profile to continue.", "success")
            return redirect(url_for("profile_form"))

    except Exception as e:
        logger.error(f"Google login error: {str(e)}")
        flash("An error occurred during login. Please try again.", "danger")
        return redirect(url_for("index"))

@app.route("/logout")
def logout():
    """Logout user and clear session"""
    try:
        # Clear session
        session.clear()
        flash("You have been successfully logged out.", "success")
        return redirect(url_for("index"))
    except Exception as e:
        logger.error(f"Logout error: {str(e)}")
        flash("An error occurred during logout.", "danger")
        return redirect(url_for("index"))

@app.route("/profile", methods=["GET", "POST"])
@require_auth
def profile_form():
    """Profile completion form"""
    try:
        # Clear old flash messages on page load
        if request.method == "GET":
            session.pop('_flashes', None)
            
        existing_participant = Participant.query.filter_by(email=session["user_email"]).first()
        if existing_participant:
            flash("Profile already exists. Redirecting to instructions.", "info")
            return redirect(url_for('instructions'))
        if request.method == "POST":
            # Get form data
            urn = request.form.get("urn", "").strip()
            crn = request.form.get("crn", "").strip()
            branch = request.form.get("branch")
            year = request.form.get("year")

            # Validation
            if not branch:
                flash("Please select your branch.", "danger")
                return render_template("profile.html")

            if not year:
                flash("Please select your year.", "danger")
                return render_template("profile.html")

            # At least one of URN or CRN required
            if not urn and not crn:
                flash("Please enter either URN or CRN.", "danger")
                return render_template("profile.html")

            # Check if participant already exists


            # Create new participant
            participant = Participant(
                google_id=session["google_id"],
                name=session["user_name"],
                email=session["user_email"],
                profile_pic=session["user_picture"],
                urn=urn if urn else None,
                crn=crn if crn else None,
                branch=branch,
                year=int(year)
            )

            db.session.add(participant)
            db.session.commit()

            flash("Profile completed successfully! You can now take the quiz.", "success")
            return redirect(url_for('instructions'))

        return render_template("profile.html")

    except Exception as e:
        logger.error(f"Profile form error: {str(e)}")
        flash("An error occurred. Please try again.", "danger")
        return render_template("profile.html")

@app.route("/instructions")
@require_auth
def instructions():
    """Quiz instructions page"""
    try:
        # Clear old flash messages on page load
        session.pop('_flashes', None)
        
        participant = get_participant()
        if not participant:
            flash("Please complete your profile first.", "warning")
            return redirect(url_for("profile_form"))

        if participant.quiz_submitted:
            flash("You have already completed the quiz.", "info")
            return redirect(url_for("thank_you"))

        return render_template("instructions.html", user_name=session.get("user_name"))

    except Exception as e:
        logger.error(f"Instructions error: {str(e)}")
        flash("An error occurred. Please try again.", "danger")
        return redirect(url_for("index"))

@app.route("/quiz", methods=["GET", "POST"])
@require_auth
def quiz():
    """Quiz page"""
    try:
        # Clear old flash messages on page load
        if request.method == "GET":
            session.pop('_flashes', None)
            
        participant = get_participant()
        if not participant:
            flash("Please complete your profile first.", "warning")
            return redirect(url_for("profile_form"))

        if participant.quiz_submitted:
            flash("You have already submitted the quiz.", "info")
            return redirect(url_for("thank_you"))

        # Quiz questions
        questions_by_category = {
            "Math": [
                {"id": 1, "question": "What is 15% of 200?", "options": ["20", "25", "30", "35"], "answer": "30"},
                {"id": 2, "question": "If x + 3 = 7, what is x?", "options": ["3", "4", "5", "6"], "answer": "4"},
                {"id": 3, "question": "Find the next number: 2, 4, 8, 16, ?", "options": ["18", "24", "32", "20"], "answer": "32"},
            ],
            "Reasoning": [
                {"id": 4, "question": "Find the odd one out: 2, 5, 7, 9", "options": ["2", "5", "7", "9"], "answer": "2"},
                {"id": 5, "question": "If all Bloops are Razzies and all Razzies are Lazzies, are all Bloops Lazzies?", "options": ["Yes", "No"], "answer": "Yes"},
            ],
            "Verbal": [
                {"id": 6, "question": "Choose the correct synonym of 'Abundant'", "options": ["Scarce", "Plentiful", "Rare", "Little"], "answer": "Plentiful"},
                {"id": 7, "question": "Choose the correct antonym of 'Scarce'", "options": ["Plentiful", "Little", "Rare", "Tiny"], "answer": "Plentiful"},
            ]
        }

        # Select questions for quiz
        quiz_questions = []
        for category, qlist in questions_by_category.items():
            selected = random.sample(qlist, min(2, len(qlist)))
            for q in selected:
                q["category"] = category
                random.shuffle(q["options"])
            quiz_questions.extend(selected)

        random.shuffle(quiz_questions)

        if request.method == "POST":
            # Process quiz submission
            user_answers = {}
            total_score = 0
            category_scores = {"Math": 0, "Reasoning": 0, "Verbal": 0}

            for q in quiz_questions:
                ans = request.form.getlist(f"q{q['id']}")
                user_answers[str(q['id'])] = ans
                category = q['category']

                # Check answer
                if q.get("multiple"):
                    if set(ans) == set(q["answer"]):
                        total_score += 1
                        category_scores[category] += 1
                else:
                    if ans and ans[0] == q["answer"]:
                        total_score += 1
                        category_scores[category] += 1

            # Save results
            participant.answers = user_answers
            participant.questions = quiz_questions  # Store the questions that were asked
            participant.score = total_score
            participant.category_scores = category_scores
            participant.quiz_submitted = True
            participant.updated_at = datetime.utcnow()
            
            db.session.commit()

            # Check if this was an auto-submit due to time up
            time_up = request.form.get('time_up', 'false').lower() == 'true'
            
            if time_up:
                flash("Time is over, so your responses have been submitted.", "warning")
            else:
                flash(f"Quiz completed! Your score: {total_score}/{len(quiz_questions)}", "success")
            
            return redirect(url_for("thank_you"))

        return render_template("quiz.html", questions=quiz_questions, timer=300)

    except Exception as e:
        logger.error(f"Quiz error: {str(e)}")
        flash("An error occurred during the quiz. Please try again.", "danger")
        return redirect(url_for("instructions"))

@app.route("/thank_you")
@require_auth
def thank_you():
    """Thank you page with results"""
    try:
        # Clear old flash messages on page load
        session.pop('_flashes', None)
        
        participant = get_participant()
        if not participant:
            flash("Please complete your profile first.", "warning")
            return redirect(url_for("profile_form"))

        if not participant.quiz_submitted:
            flash("Please complete the quiz first.", "warning")
            return redirect(url_for("quiz"))

        return render_template("thank_you.html", name=participant.name, score=participant.score)

    except Exception as e:
        logger.error(f"Thank you page error: {str(e)}")
        flash("An error occurred. Please try again.", "danger")
        return redirect(url_for("index"))

@app.route("/leaderboard")
@require_auth
@require_admin
def leaderboard():
    """Leaderboard page (admin only)"""
    try:
        return render_template("leaderboard.html")
    except Exception as e:
        logger.error(f"Leaderboard error: {str(e)}")
        flash("An error occurred loading the leaderboard.", "danger")
        return redirect(url_for("index"))

@app.route("/leaderboard_data")
@require_auth
@require_admin
def leaderboard_data():
    """API endpoint for leaderboard data (admin only)"""
    try:
        participants = Participant.query.filter_by(quiz_submitted=True).order_by(Participant.score.desc()).all()

        data = []
        for p in participants:
            data.append({
                "id": p.id,
                "email": p.email,
                "name": p.name or "Unknown",
                "score": p.score or 0,
                "category_scores": p.category_scores or {"Math": 0, "Reasoning": 0, "Verbal": 0},
                "profile_pic": p.profile_pic or None,
                "created_at": p.created_at.isoformat() if p.created_at else None
            })

        return jsonify({"success": True, "data": data})

    except Exception as e:
        logger.error(f"Leaderboard data error: {str(e)}")
        return jsonify({"success": False, "error": "Failed to load leaderboard data"}), 500

@app.route("/dev")
def dev():
    """Developer page showcasing the developer"""
    # Clear old flash messages on page load
    session.pop('_flashes', None)
    return render_template("dev.html")

@app.route("/send_quiz_email", methods=["POST"])
@require_auth
def send_quiz_email():
    """Send quiz results via email"""
    try:
        participant = get_participant()
        if not participant or not participant.quiz_submitted:
            flash("Please complete the quiz first.", "warning")
            return redirect(url_for("quiz"))

        # Get the questions that were actually asked from the database
        quiz_questions = participant.questions or []
        
        if not quiz_questions:
            flash("No quiz questions found. Please contact support.", "warning")
            return redirect(url_for("thank_you"))

        # Schedule email to be sent later
        scheduler.add_job(
            send_email_later,
            'date',
            run_date=datetime.now() + timedelta(hours=1),
            args=[participant.email, quiz_questions, participant.answers, participant.score],
            id=f"email_{participant.id}_{datetime.now().timestamp()}"
        )

        flash("Your detailed quiz results will be emailed to you within 1 hour!", "success")
        return redirect(url_for("thank_you"))

    except Exception as e:
        logger.error(f"Email scheduling error: {str(e)}")
        flash("Failed to schedule email. Please try again.", "danger")
        return redirect(url_for("thank_you"))

def send_email_later(participant_email, questions, answers, score):
    """Send quiz results email with detailed question analysis"""
    try:
        msg = Message(
            "Your Aptitude Quiz Results - ITian Club",
            sender=app.config['MAIL_DEFAULT_SENDER'],
            recipients=[participant_email]
        )

        # Build detailed HTML content
        html_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; color: white; text-align: center;">
                <h1>ITian Club Aptitude Quiz Results</h1>
            </div>
            <div style="padding: 20px;">
                <h2>Congratulations!</h2>
                <p>Thank you for participating in the ITian Club Aptitude Quiz.</p>
                
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <h3>Your Score: {score}/{len(questions)}</h3>
                    <p>Percentage: {(score/len(questions))*100:.1f}%</p>
                </div>

                <h3>Detailed Question Analysis:</h3>
        """

        current_category = None
        for q in questions:
            user_ans = answers.get(str(q['id']), [])
            correct_ans = q['answer']
            
            # Add category header only once
            if q['category'] != current_category:
                html_body += f"<h4 style='color: #667eea; margin-top: 20px;'>{q['category']} Questions</h4>"
                current_category = q['category']

            # Determine if answer was correct
            is_correct = False
            if q.get("multiple"):
                is_correct = set(user_ans) == set(correct_ans)
            else:
                is_correct = user_ans and user_ans[0] == correct_ans

            status_color = "#28a745" if is_correct else "#dc3545"
            status_text = "✓ Correct" if is_correct else "✗ Incorrect"

            html_body += f"""
                <div style="background: white; border-left: 4px solid {status_color}; padding: 15px; margin: 10px 0; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <p><strong>Q{q['id']}: {q['question']}</strong></p>
                    <p style="margin: 5px 0;"><strong>Your Answer:</strong> {', '.join(user_ans) if user_ans else 'No answer'}</p>
                    <p style="margin: 5px 0;"><strong>Correct Answer:</strong> {correct_ans}</p>
                    <p style="margin: 5px 0; color: {status_color};"><strong>Status:</strong> {status_text}</p>
                </div>
            """

        html_body += """
                <hr style="margin: 30px 0;">
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
                    <h4>Performance Summary:</h4>
                    <p>• Review your answers to understand where you can improve</p>
                    <p>• Focus on the categories where you scored lower</p>
                    <p>• Practice similar questions to enhance your skills</p>
                </div>
                
                <hr style="margin: 30px 0;">
                <p><em>Thank you for your participation!</em></p>
                <p><strong>– ITian Club Team</strong></p>
            </div>
        </body>
        </html>
        """

        msg.html = html_body
        mail.send(msg)
        logger.info(f"Detailed email sent successfully to {participant_email}")

    except Exception as e:
        logger.error(f"Email sending error: {str(e)}")

# Error Handlers
@app.errorhandler(404)
def not_found_error(error):
    return render_template('404.html'), 404

@app.errorhandler(500)
def internal_error(error):
    db.session.rollback()
    return render_template('500.html'), 500

@app.errorhandler(403)
def forbidden_error(error):
    return render_template('403.html'), 403

if __name__ == "__main__":
    app.run(debug=True, port=5000)
