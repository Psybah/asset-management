"""Question definitions for the usability questionnaire (docs/sus-questionnaire.md).

Single source of truth: the model choices, the validation rules, the public form
definition served at /api/survey/form/ and the results aggregation all read from here.
"""


def _opts(*pairs):
    return [{"value": v, "label": label} for v, label in pairs]


# Section A — about you. `other_field` names the free-text field used when "other" is picked.
DEMOGRAPHICS = [
    {
        "id": "department", "code": "A1", "label": "Department / unit",
        "options": _opts(
            ("engineering", "Engineering"),
            ("product_design", "Product & Design"),
            ("operations", "Operations"),
            ("compliance_risk", "Compliance & Risk"),
            ("finance", "Finance"),
            ("growth_partnerships", "Growth & Partnerships"),
            ("people_culture", "People & Culture"),
            ("internal_audit", "Internal Audit"),
            ("other", "Other"),
        ),
        "other_field": "department_other",
    },
    {
        "id": "role", "code": "A2", "label": "Your role in relation to office assets",
        "options": _opts(
            ("manage", "I manage or record assets (e.g. store officer, admin officer, IT support)"),
            ("use", "I use assets assigned to me but do not manage them"),
            ("supervisor", "Supervisor / head of unit"),
            ("other", "Other"),
        ),
        "other_field": "role_other",
    },
    {
        "id": "age_group", "code": "A3", "label": "Age group",
        "options": _opts(
            ("under_25", "Under 25"), ("25_34", "25–34"), ("35_44", "35–44"),
            ("45_54", "45–54"), ("55_plus", "55 and above"),
        ),
        "other_field": None,
    },
    {
        "id": "computer_use", "code": "A4", "label": "How often do you use computers at work?",
        "options": _opts(
            ("daily", "Daily"), ("weekly", "A few times a week"), ("rarely", "Rarely"), ("never", "Never"),
        ),
        "other_field": None,
    },
    {
        "id": "current_method", "code": "A5",
        "label": "How is asset information mostly recorded in your office today?",
        "options": _opts(
            ("paper", "Paper registers / files"),
            ("spreadsheet", "Spreadsheets (e.g. Excel)"),
            ("software", "A dedicated software system"),
            ("not_sure", "Not sure"),
        ),
        "other_field": None,
    },
    {
        "id": "prior_software", "code": "A6",
        "label": "Have you used any asset or inventory management software before?",
        "options": _opts(("yes", "Yes"), ("no", "No")),
        "other_field": None,
    },
    {
        "id": "device", "code": "A7", "label": "Device used for this evaluation",
        "options": _opts(("desktop", "Desktop / laptop"), ("smartphone", "Smartphone"), ("tablet", "Tablet")),
        "other_field": None,
    },
]

# Section B — tasks to try first.
TASKS = [
    {"id": "T1", "text": "Log in with the account given to you"},
    {"id": "T2", "text": "Find the asset with tag AST-0005 using search"},
    {"id": "T3", "text": "Scan an asset's QR label with a phone and view its details"},
    {"id": "T4", "text": "Check an available asset out to a staff member, then check it back in"},
    {"id": "T5", "text": "Schedule a maintenance job for an asset"},
    {"id": "T6", "text": "View an asset's depreciation schedule and current value"},
    {"id": "T7", "text": "Download the asset register as a CSV report"},
]
TASK_IDS = [t["id"] for t in TASKS]
TASK_OUTCOMES = _opts(
    ("without_help", "Completed without help"),
    ("with_help", "Completed with help"),
    ("not_completed", "Not completed"),
)

# Section C — the ten standard SUS items (Brooke, 1996), verbatim.
SUS_ITEMS = [
    "I think that I would like to use this system frequently.",
    "I found the system unnecessarily complex.",
    "I thought the system was easy to use.",
    "I think that I would need the support of a technical person to be able to use this system.",
    "I found the various functions in this system were well integrated.",
    "I thought there was too much inconsistency in this system.",
    "I would imagine that most people would learn to use this system very quickly.",
    "I found the system very cumbersome to use.",
    "I felt very confident using the system.",
    "I needed to learn a lot of things before I could get going with this system.",
]
SUS_SCALE = [
    {"value": 1, "label": "Strongly disagree"},
    {"value": 2, "label": "Disagree"},
    {"value": 3, "label": "Neutral"},
    {"value": 4, "label": "Agree"},
    {"value": 5, "label": "Strongly agree"},
]
SUS_FIELDS = [f"q{i}" for i in range(1, 11)]

# Section D — overall opinion.
ADJECTIVE = {
    "id": "adjective", "code": "D1",
    "label": "Overall, how would you rate the user-friendliness of this system?",
    "source": "Bangor, Kortum & Miller (2009)",
    "options": _opts(
        ("worst_imaginable", "Worst imaginable"), ("awful", "Awful"), ("poor", "Poor"), ("ok", "OK"),
        ("good", "Good"), ("excellent", "Excellent"), ("best_imaginable", "Best imaginable"),
    ),
}
COMPARISON = {
    "id": "comparison", "code": "D2",
    "label": "Compared with how assets are recorded in your office today, would this system make asset tracking:",
    "options": _opts(
        ("much_easier", "Much easier"), ("easier", "Easier"), ("same", "About the same"),
        ("harder", "Harder"), ("much_harder", "Much harder"),
    ),
}
OPEN_QUESTIONS = [
    {"id": "liked", "code": "D3", "label": "What did you like most about the system?"},
    {"id": "improvements", "code": "D4", "label": "What should be improved?"},
]

# Score bands used in the results (Bangor et al., 2009; Sauro, 2011: average = 68).
SCORE_BANDS = [  # `below` = exclusive upper bound (scores are multiples of 2.5)
    {"band": "<50", "label": "Not acceptable", "below": 50},
    {"band": "50–67.9", "label": "Marginal (below average)", "below": 68},
    {"band": "68–80.2", "label": "Good (above average)", "below": 80.3},
    {"band": ">80.3", "label": "Excellent", "below": None},
]


def choices(options):
    return [(o["value"], o["label"]) for o in options]


def demographic(field_id):
    return next(d for d in DEMOGRAPHICS if d["id"] == field_id)


def sus_score(answers):
    """Standard SUS score (Brooke, 1996) from the ten 1–5 answers, in item order.

    Odd items contribute (answer − 1), even items (5 − answer); the 0–40 sum × 2.5 gives 0–100.
    """
    answers = list(answers)
    if len(answers) != 10 or any(a is None or not 1 <= int(a) <= 5 for a in answers):
        raise ValueError("SUS needs ten answers between 1 and 5.")
    total = sum((a - 1) if i % 2 == 0 else (5 - a) for i, a in enumerate(int(a) for a in answers))
    return total * 2.5


def form_definition():
    return {
        "title": "Usability questionnaire",
        "intro": (
            "Please use the system to complete the short tasks below, then answer the questions. "
            "It takes about 10 minutes. Taking part is voluntary and anonymous: please do not write your name."
        ),
        "demographics": [
            {**d, "required": True, "allow_other": bool(d["other_field"])} for d in DEMOGRAPHICS
        ],
        "tasks": TASKS,
        "task_outcomes": TASK_OUTCOMES,
        "sus": {
            "instructions": (
                "Each statement is about the system you have just used. Give your immediate reaction; "
                "if you feel you cannot answer an item, choose the middle option (3)."
            ),
            "source": "Brooke (1996)",
            "scale": SUS_SCALE,
            "items": [{"item": i + 1, "field": SUS_FIELDS[i], "text": text} for i, text in enumerate(SUS_ITEMS)],
        },
        "adjective": {**ADJECTIVE, "required": True},
        "comparison": {**COMPARISON, "required": True},
        "open_questions": [{**q, "required": False, "max_length": 2000} for q in OPEN_QUESTIONS],
    }
