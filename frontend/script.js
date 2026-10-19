
const API_URL = "https://ai-resume-analyzer-4bla.onrender.com";

const resumeInput = document.getElementById("resumeFile");
const dropZone = document.getElementById("dropZone");
const fileInfo = document.getElementById("fileInfo");
const fileName = document.getElementById("fileName");
const jobInput = document.getElementById("jobDescription");
const analyzeBtn = document.getElementById("analyzeBtn");
const statusBox = document.getElementById("status");
const results = document.getElementById("results");

let selectedFile = null;
let latestReport = null;

function showStatus(message, isError = false) {
    statusBox.textContent = message;
    statusBox.classList.toggle("error", isError);
    statusBox.hidden = false;
}

function hideStatus() {
    statusBox.hidden = true;
}

function selectFile(file) {
    if (!file) return;

    if (file.type !== "application/pdf" &&
        !file.name.toLowerCase().endsWith(".pdf")) {
        showStatus("Please select a PDF file.", true);
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        showStatus("Please choose a PDF smaller than 5 MB.", true);
        return;
    }

    if (file.size === 0) {
        showStatus("The selected file is empty.", true);
        return;
    }

    selectedFile = file;
    resumeInput.value = "";
    fileName.textContent = file.name;
    document.getElementById("uploadTitle").textContent = "Resume selected";
    document.getElementById("uploadHint").textContent =
        "Choose another file to replace it";
    fileInfo.hidden = false;

    hideStatus();
    results.hidden = true;
}

resumeInput.addEventListener("change", () => {
    selectFile(resumeInput.files[0]);
});

dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropZone.classList.add("dragging");
});

dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragging");
});

dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropZone.classList.remove("dragging");

    const file = event.dataTransfer.files[0];
    selectFile(file);
});

document.getElementById("removeFile").addEventListener("click", () => {
    selectedFile = null;
    resumeInput.value = "";
    fileInfo.hidden = true;
    document.getElementById("uploadTitle").textContent =
        "Choose your resume";
    document.getElementById("uploadHint").textContent =
        "Click to browse or drag a PDF here";
    results.hidden = true;
    hideStatus();
});

jobInput.addEventListener("input", () => {
    document.getElementById("charCount").textContent =
        `${jobInput.value.length} characters`;

    results.hidden = true;
});

function renderSkills(elementId, skills, kind) {
    const container = document.getElementById(elementId);
    container.replaceChildren();

    if (!skills || skills.length === 0) {
        const empty = document.createElement("span");
        empty.className = "empty-skills";
        empty.textContent = "No skills detected.";
        container.appendChild(empty);
        return;
    }

    skills.forEach((skill) => {
        const chip = document.createElement("span");
        chip.className = `skill-chip ${kind}`;
        chip.textContent = skill;
        container.appendChild(chip);
    });
}

function displayResults(data) {
    document.getElementById("matchScore").textContent =
        data.match_score;

    document.getElementById("matchingCount").textContent =
        data.matching_skills.length;

    document.getElementById("missingCount").textContent =
        data.missing_skills.length;

    document.getElementById("scoreBar").style.width =
        `${Math.max(0, Math.min(100, data.match_score))}%`;

    renderSkills("matchingSkills", data.matching_skills, "");
    renderSkills("missingSkills", data.missing_skills, "missing");
    renderSkills("resumeSkills", data.resume_skills, "neutral");

    latestReport = data;
    results.hidden = false;
    results.scrollIntoView({ behavior: "smooth", block: "start" });
}

analyzeBtn.addEventListener("click", async () => {
    if (!selectedFile) {
        showStatus("Please upload your resume first.", true);
        return;
    }

    const jobDescription = jobInput.value.trim();

    if (!jobDescription) {
        showStatus("Please enter the job description.", true);
        return;
    }

    const formData = new FormData();
    formData.append("resume", selectedFile);
    formData.append("job_description", jobDescription);

    analyzeBtn.disabled = true;
    analyzeBtn.textContent = "Analyzing...";
    results.hidden = true;
    showStatus("Analyzing your resume. Please wait.");

    try {
        const response = await fetch(`${API_URL}/analyze`, {
            method: "POST",
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Analysis failed.");
        }

        displayResults(data);
        showStatus("Analysis completed successfully.");
    } catch (error) {
        showStatus(
            `${error.message}. Make sure the Python backend is running.`,
            true
        );
    } finally {
        analyzeBtn.disabled = false;
        analyzeBtn.innerHTML = 'Analyze my resume <span>→</span>';
    }
});

document.getElementById("downloadBtn").addEventListener("click", () => {
    if (!latestReport) return;

    const data = latestReport;

    const report = [
        "AI RESUME ANALYZER REPORT",
        "=========================",
        `Estimated Match: ${data.match_score}%`,
        `Text Similarity: ${data.text_score}%`,
        "",
        "Matching Skills:",
        data.matching_skills.join(", ") || "None detected",
        "",
        "Skills to Review:",
        data.missing_skills.join(", ") || "None detected",
        "",
        "Skills Detected in Resume:",
        data.resume_skills.join(", ") || "None detected",
        "",
        "This is an estimate, not an official ATS score."
    ].join("\n");

    const blob = new Blob([report], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "resume_analysis.txt";
    link.click();

    URL.revokeObjectURL(url);
});
