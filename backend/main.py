
import re


import pymupdf
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


app = FastAPI(title="AI Resume Analyzer API", version="1.0.0")

# Development configuration. Restrict this to your actual frontend
# origins before deploying a public production application.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://127.0.0.1:8000",
        "http://localhost:8000",
        "https://funny-youtiao-e84ed7.netlify.app",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

MAX_FILE_SIZE = 5 * 1024 * 1024

SKILLS = [
    "python", "java", "c++", "sql", "javascript", "html",
    "css", "react", "node.js", "flask", "django", "streamlit",
    "machine learning", "deep learning", "artificial intelligence",
    "data analysis", "pandas", "numpy", "scikit-learn",
    "tensorflow", "pytorch", "opencv", "nlp",
    "data structures", "algorithms", "problem solving",
    "object-oriented programming", "git", "github", "docker",
    "aws", "azure", "linux", "mongodb", "mysql", "postgresql",
    "communication", "teamwork", "rest api", "fastapi", "excel"
]


def find_skills(text: str) -> set:
    found = set()
    text = text.lower()

    for skill in SKILLS:
        pattern = r"(?<!\w)" + re.escape(skill) + r"(?!\w)"
        if re.search(pattern, text):
            found.add(skill)

    return found


def get_similarity(resume_text: str, job_text: str) -> float:
    try:
        vectorizer = TfidfVectorizer(stop_words="english")
        vectors = vectorizer.fit_transform(
            [resume_text, job_text]
        )
        score = cosine_similarity(
            vectors[0:1], vectors[1:2]
        )[0][0]

        return round(float(score) * 100, 2)

    except ValueError:
        return 0.0


@app.get("/")
def home():
    return {
        "status": "online",
        "message": "AI Resume Analyzer API is running"
    }


@app.post("/analyze")
async def analyze_resume(
    resume: UploadFile = File(...),
    job_description: str = Form(...)
):
    if not resume.filename or not resume.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Please upload a PDF resume."
        )

    if not job_description.strip():
        raise HTTPException(
            status_code=400,
            detail="Please enter a job description."
        )

    if len(job_description) > 30000:
        raise HTTPException(
            status_code=400,
            detail="The job description is too long."
        )

    # Read at most 5 MB plus one byte to detect oversized files.
    pdf_bytes = await resume.read(MAX_FILE_SIZE + 1)

    if len(pdf_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="The PDF must be 5 MB or smaller."
        )

    if not pdf_bytes.startswith(b"%PDF-"):
        raise HTTPException(
            status_code=400,
            detail="The uploaded file is not a valid PDF."
        )

    try:
       with pymupdf.open(stream=pdf_bytes, filetype="pdf") as pdf:
            if pdf.page_count > 30:
                raise HTTPException(
                    status_code=400,
                    detail="Please upload a PDF with no more than 30 pages."
                )

            resume_text = "\n".join(
                page.get_text() for page in pdf
            ).strip()

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Could not read the PDF. Try another text-based PDF."
        )

    if len(resume_text) < 30:
        raise HTTPException(
            status_code=400,
            detail="No readable text found. Scanned PDFs are not supported yet."
        )

    resume_skills = find_skills(resume_text)
    job_skills = find_skills(job_description)

    matching = sorted(resume_skills & job_skills)
    missing = sorted(job_skills - resume_skills)

    text_score = get_similarity(resume_text, job_description)

    if job_skills:
        skill_score = len(matching) / len(job_skills) * 100
        match_score = round(
            0.7 * skill_score + 0.3 * text_score, 2
        )
    else:
        match_score = text_score

    return {
        "match_score": match_score,
        "text_score": text_score,
        "resume_skills": sorted(resume_skills),
        "job_skills": sorted(job_skills),
        "matching_skills": matching,
        "missing_skills": missing,
    }
