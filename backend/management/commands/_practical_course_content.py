"""Authored content for the practical English courses (see ``seed_practical_courses``).

This module is *pure data*: fifteen short, practical courses (5 A2, 7 B1, 3 B2) plus
a tiny SVG cover generator. It contains no ORM access. The ``seed_practical_courses``
command resolves the character names and ``background`` stems used here against the
art already mirrored to Cloudinary by the a2/b1 crawl, so no new character art or
scene images are generated — only a per-course topic cover is produced + uploaded.

Authoring shorthands (expanded by the command):
- ``characters`` are bare names; only names that have real mirrored art are used
  (Female: Alice, Anna, Linda, Lisa, Maria, Sarah, Sophie — Male: Bob, Brian,
  David, Jake, James, Tom).
- ``lines`` are ``(speaker, text)`` tuples; ``align`` is derived from the speaker's
  side (first character → left, second → right, …).
- ``background`` is the stem of an existing scene image (e.g. ``"cafe"``).
- ``exercises`` use ``answers=[...]`` for fill-in-the-blank (expanded to the
  ``blanks`` shape the lesson page renders) and ``questions=[{text, answers}]`` for
  multiple-choice.
"""

import base64

# ── SVG topic cover ────────────────────────────────────────────────────────
# Minimalist line-art motifs drawn in a 0..100 box, recolored white, used purely
# as decorative topic flavor on the gradient cover.
_ICONS = {
    "chat": '<rect x="8" y="16" width="58" height="40" rx="10"/><rect x="34" y="46" width="56" height="38" rx="10"/>',
    "map": '<path d="M50 10 C30 10 18 26 18 44 C18 64 50 92 50 92 '
    'C50 92 82 64 82 44 C82 26 70 10 50 10 Z"/><circle cx="50" cy="42" r="12"/>',
    "coffee": '<path d="M22 38 h44 v16 a22 22 0 0 1 -44 0 Z"/>'
    '<path d="M66 42 h8 a10 10 0 0 1 0 20 h-4"/>'
    '<path d="M34 16 v10 M50 14 v10 M66 16 v10"/>',
    "briefcase": '<rect x="14" y="34" width="72" height="48" rx="8"/>'
    '<path d="M38 34 v-10 h24 v10"/><line x1="14" y1="56" x2="86" y2="56"/>',
    "calendar": '<rect x="16" y="22" width="68" height="62" rx="8"/>'
    '<line x1="16" y1="40" x2="84" y2="40"/>'
    '<line x1="34" y1="14" x2="34" y2="28"/><line x1="66" y1="14" x2="66" y2="28"/>',
    "users": '<circle cx="38" cy="34" r="14"/>'
    '<path d="M14 84 c0 -20 12 -28 24 -28 s24 8 24 28"/>'
    '<circle cx="70" cy="40" r="11"/><path d="M62 84 c0 -16 8 -24 20 -24"/>',
    "phone": '<rect x="34" y="12" width="34" height="76" rx="9"/><line x1="45" y1="78" x2="57" y2="78"/>',
    "plane": '<path d="M12 56 L88 28 L78 46 L48 54 L66 82 L54 84 L36 60 L20 64 Z"/>',
    "wrench": '<path d="M72 16 a16 16 0 0 0 -21 21 L18 70 l12 12 l33 -33 '
    'a16 16 0 0 0 21 -21 l-13 13 l-11 -2 l-2 -11 Z"/>',
    "deck": '<rect x="16" y="18" width="68" height="46" rx="6"/>'
    '<path d="M30 50 l10 -12 l8 8 l12 -16"/>'
    '<line x1="50" y1="64" x2="50" y2="78"/><line x1="34" y1="86" x2="66" y2="86"/>',
}


def _wrap(title, max_chars=15):
    words, lines, cur = title.split(), [], ""
    for word in words:
        if cur and len(cur) + len(word) + 1 > max_chars:
            lines.append(cur)
            cur = word
        else:
            cur = f"{cur} {word}".strip()
    if cur:
        lines.append(cur)
    return lines[:3]


def make_cover_svg(title, level, theme):
    """Return SVG markup for a 1200x630 topic cover (gradient + motif + title)."""
    c1, c2 = theme["c1"], theme["c2"]
    icon = _ICONS.get(theme.get("icon", ""), "")
    title_lines = _wrap(title)
    line_h = 92
    start_y = 360 - (len(title_lines) - 1) * line_h // 2
    tspans = "".join(
        f'<text x="96" y="{start_y + i * line_h}" font-family="Segoe UI, Helvetica, Arial, sans-serif" '
        f'font-size="84" font-weight="800" fill="#ffffff">{line}</text>'
        for i, line in enumerate(title_lines)
    )
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">'
        f'<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">'
        f'<stop offset="0" stop-color="{c1}"/><stop offset="1" stop-color="{c2}"/></linearGradient></defs>'
        '<rect width="1200" height="630" fill="url(#g)"/>'
        '<circle cx="1040" cy="120" r="220" fill="#ffffff" opacity="0.08"/>'
        '<circle cx="1140" cy="560" r="160" fill="#ffffff" opacity="0.07"/>'
        '<g transform="translate(910,210) scale(2.6)" fill="none" stroke="#ffffff" '
        'stroke-width="5" stroke-linecap="round" stroke-linejoin="round" opacity="0.9">'
        f"{icon}</g>"
        '<rect x="96" y="84" width="150" height="56" rx="28" fill="#ffffff" opacity="0.18"/>'
        f'<text x="171" y="122" text-anchor="middle" font-family="Segoe UI, Helvetica, Arial, sans-serif" '
        f'font-size="34" font-weight="700" fill="#ffffff">{level}</text>'
        f"{tspans}"
        '<text x="96" y="540" font-family="Segoe UI, Helvetica, Arial, sans-serif" '
        'font-size="30" font-weight="500" fill="#ffffff" opacity="0.85">'
        "FlashLearn &#183; Practical English</text>"
        "</svg>"
    )


def cover_data_uri(title, level, theme):
    svg = make_cover_svg(title, level, theme)
    return "data:image/svg+xml;base64," + base64.b64encode(svg.encode("utf-8")).decode("ascii")


# ── Exercise shorthands ──────────────────────────────────────────────────────
def _fb(title, prompt, sentence, *answers):
    return {"kind": "fill_blank", "title": title, "prompt": prompt, "sentence": sentence, "answers": list(answers)}


def _mc(title, prompt, question, *answers):
    return {
        "kind": "choice",
        "title": title,
        "prompt": prompt,
        "questions": [{"text": question, "answers": list(answers)}],
    }


# ── Courses ──────────────────────────────────────────────────────────────────
# Each lesson: slug, title, description, background (stem), characters (names),
# lines [(speaker, text)], exercises [...].
COURSES = [
    # ===================== A2 =====================
    {
        "slug": "everyday-conversation-a2",
        "title": "Everyday Conversation (A2)",
        "level": "A2",
        "order": 3,
        "description": "Elementary English for greetings, small talk and everyday chats. "
        "Listen, study the transcript, then pass each lesson with a Live Role-play.",
        "cover": {"c1": "#6C5CE7", "c2": "#8E7CF0", "icon": "chat"},
        "sections": [
            {
                "slug": "greetings",
                "title": "Greetings & Introductions",
                "description": "Say hello and introduce yourself.",
                "lessons": [
                    {
                        "slug": "saying-hello",
                        "title": "Saying Hello",
                        "description": "A friendly first hello at the office.",
                        "background": "company1-reception",
                        "characters": ["Maria", "Tom"],
                        "lines": [
                            ("Maria", "Hi, good morning! You must be the new developer."),
                            ("Tom", "Good morning! Yes, that's me. I'm Tom, and it's my first day."),
                            ("Maria", "Welcome, Tom! I'm Maria. How are you feeling so far?"),
                            ("Tom", "A little nervous, to be honest, but really happy to be here."),
                            ("Maria", "Don't worry, everyone here is very friendly."),
                            ("Tom", "Thank you, that's really nice to hear."),
                        ],
                        "exercises": [
                            _fb("Greeting", "Complete the greeting.", "Good ___, how are you today?", "morning")
                        ],
                    }
                ],
            },
            {
                "slug": "small-talk",
                "title": "Small Talk",
                "description": "Chat about the weekend and the weather.",
                "lessons": [
                    {
                        "slug": "how-was-your-weekend",
                        "title": "How Was Your Weekend?",
                        "description": "Light small talk by the coffee machine.",
                        "background": "company2-breakroom",
                        "characters": ["Maria", "Tom"],
                        "lines": [
                            ("Tom", "Morning, Maria. How was your weekend?"),
                            ("Maria", "It was lovely, thanks. I went to the park with my family."),
                            ("Tom", "That sounds nice. The weather was really good, wasn't it?"),
                            ("Maria", "It was perfect. What about you? Did you do anything fun?"),
                            ("Tom", "Not much, really. I stayed home and watched a few movies."),
                            ("Maria", "Sometimes a quiet weekend is exactly what you need."),
                        ],
                        "exercises": [
                            _mc(
                                "Small talk",
                                "Pick a good reply.",
                                "Your weekend was relaxing. What can you say?",
                                "It was great, I stayed home.",
                                "I am a computer.",
                            )
                        ],
                    }
                ],
            },
            {
                "slug": "asking-for-help",
                "title": "Asking for Help",
                "description": "Ask for help politely.",
                "lessons": [
                    {
                        "slug": "can-you-help-me",
                        "title": "Can You Help Me?",
                        "description": "Asking a colleague for a small favor.",
                        "background": "company2-center",
                        "characters": ["Maria", "Tom"],
                        "lines": [
                            ("Tom", "Excuse me, Maria. Could you help me with something quick?"),
                            ("Maria", "Of course. What do you need?"),
                            ("Tom", "I can't find the meeting room. Do you know where it is?"),
                            ("Maria", "Sure, it's on the second floor, right next to the kitchen."),
                            ("Tom", "Great, thank you so much for your help."),
                            ("Maria", "No problem at all. Just ask me anytime."),
                        ],
                        "exercises": [
                            _fb("Polite request", "Complete the request.", "Excuse me, ___ you help me?", "can")
                        ],
                    }
                ],
            },
            {
                "slug": "saying-goodbye",
                "title": "Saying Goodbye",
                "description": "End a conversation politely.",
                "lessons": [
                    {
                        "slug": "see-you-tomorrow",
                        "title": "See You Tomorrow",
                        "description": "Leaving the office at the end of the day.",
                        "background": "company1-reception",
                        "characters": ["Maria", "Tom"],
                        "lines": [
                            ("Maria", "Right, I'm heading home now. See you tomorrow, Tom."),
                            ("Tom", "Have a good evening, Maria. Get home safely."),
                            ("Maria", "Thanks, you too. Don't stay too late!"),
                            ("Tom", "I won't. I'm leaving in a few minutes as well."),
                            ("Maria", "Good. See you bright and early. Bye!"),
                        ],
                        "exercises": [_fb("Farewell", "Complete the goodbye.", "See you ___!", "tomorrow")],
                    }
                ],
            },
            {
                "slug": "phone-basics",
                "title": "Phone Basics",
                "description": "Answer a simple phone call.",
                "lessons": [
                    {
                        "slug": "answering-the-phone",
                        "title": "Answering the Phone",
                        "description": "A short, simple phone call.",
                        "background": "company2-center",
                        "characters": ["Maria", "Tom"],
                        "lines": [
                            ("Maria", "Hello, this is Maria speaking. How can I help?"),
                            ("Tom", "Hi Maria, it's Tom. Is David around at the moment?"),
                            ("Maria", "Sorry, he's not at his desk right now."),
                            ("Tom", "No problem. Could you let him know that I called?"),
                            ("Maria", "Of course. I'll pass on the message as soon as he's back."),
                            ("Tom", "Thanks a lot. Talk to you later. Bye!"),
                        ],
                        "exercises": [
                            _mc(
                                "On the phone",
                                "Choose the best phrase to answer a call.",
                                "You pick up the office phone. What do you say?",
                                "Hello, this is Maria speaking.",
                                "Goodbye now.",
                            )
                        ],
                    }
                ],
            },
        ],
    },
    {
        "slug": "out-and-about-a2",
        "title": "Out and About in Town (A2)",
        "level": "A2",
        "order": 4,
        "description": "Elementary English for getting around: directions, transport and shopping. "
        "Listen, study the transcript, then pass each lesson with a Live Role-play.",
        "cover": {"c1": "#00B4D8", "c2": "#0077B6", "icon": "map"},
        "sections": [
            {
                "slug": "directions",
                "title": "Asking for Directions",
                "description": "Find your way around town.",
                "lessons": [
                    {
                        "slug": "where-is-the-station",
                        "title": "Where Is the Station?",
                        "description": "Asking a stranger for directions.",
                        "background": "company2-parking",
                        "characters": ["Sophie", "Bob"],
                        "lines": [
                            ("Sophie", "Excuse me, could you tell me where the train station is?"),
                            ("Bob", "Sure. Go straight ahead and turn left at the bank."),
                            ("Sophie", "Okay. Is it very far from here?"),
                            ("Bob", "Not at all. It's only about five minutes on foot."),
                            ("Sophie", "That's great. Thank you so much for your help!"),
                            ("Bob", "You're welcome. Have a safe trip!"),
                        ],
                        "exercises": [
                            _fb(
                                "Directions",
                                "Complete the directions.",
                                "Go straight and ___ left at the bank.",
                                "turn",
                            )
                        ],
                    }
                ],
            },
            {
                "slug": "public-transport",
                "title": "Public Transport",
                "description": "Buy a ticket and take the bus.",
                "lessons": [
                    {
                        "slug": "buying-a-ticket",
                        "title": "Buying a Ticket",
                        "description": "Buying a bus ticket downtown.",
                        "background": "company2-parking",
                        "characters": ["Sophie", "Bob"],
                        "lines": [
                            ("Sophie", "Hi, one ticket to the city center, please."),
                            ("Bob", "That's two dollars. Would you like a single or a return?"),
                            ("Sophie", "Just a single, please. Which bus should I take?"),
                            ("Bob", "Take the number nine. It leaves from platform two."),
                            ("Sophie", "Perfect. How often do they run?"),
                            ("Bob", "Every ten minutes, so you won't have to wait long."),
                        ],
                        "exercises": [
                            _mc(
                                "Tickets",
                                "Pick the right question.",
                                "You want to know the bus number. What do you ask?",
                                "Which bus do I take?",
                                "What is your name?",
                            )
                        ],
                    }
                ],
            },
            {
                "slug": "shopping",
                "title": "Shopping",
                "description": "Shop for clothes and ask about prices.",
                "lessons": [
                    {
                        "slug": "at-the-shop",
                        "title": "At the Shop",
                        "description": "Buying a shirt in a clothing shop.",
                        "background": "company3-reception",
                        "characters": ["Sophie", "Bob"],
                        "lines": [
                            ("Sophie", "Excuse me, how much is this blue shirt?"),
                            ("Bob", "It's fifteen dollars. It's one of our most popular ones."),
                            ("Sophie", "Do you have it in a larger size?"),
                            ("Bob", "Let me check. Yes, here's a medium. Would you like to try it on?"),
                            ("Sophie", "Yes, please. Where's the changing room?"),
                            ("Bob", "It's just over there, on your right."),
                        ],
                        "exercises": [_fb("Prices", "Complete the question.", "How ___ is this shirt?", "much")],
                    }
                ],
            },
            {
                "slug": "at-the-restaurant",
                "title": "At the Restaurant",
                "description": "Order a meal at a restaurant.",
                "lessons": [
                    {
                        "slug": "ordering-food",
                        "title": "Ordering Food",
                        "description": "Ordering lunch at a small restaurant.",
                        "background": "cafe",
                        "characters": ["Sophie", "Bob"],
                        "lines": [
                            ("Bob", "Good afternoon. Are you ready to order?"),
                            ("Sophie", "Yes, I think so. I'd like the chicken salad, please."),
                            ("Bob", "Good choice. Would you like anything to drink with that?"),
                            ("Sophie", "Just a glass of water, please."),
                            ("Bob", "Of course. Would you like still or sparkling?"),
                            ("Sophie", "Still is fine, thank you."),
                        ],
                        "exercises": [
                            _fb("Ordering", "Complete the polite order.", "I'd ___ the chicken salad, please.", "like")
                        ],
                    }
                ],
            },
            {
                "slug": "money-and-prices",
                "title": "Money & Prices",
                "description": "Pay and check your change.",
                "lessons": [
                    {
                        "slug": "paying-at-the-counter",
                        "title": "Paying at the Counter",
                        "description": "Paying for shopping at the till.",
                        "background": "company3-reception",
                        "characters": ["Sophie", "Bob"],
                        "lines": [
                            ("Sophie", "How much is that altogether?"),
                            ("Bob", "That comes to twenty dollars in total."),
                            ("Sophie", "Can I pay by card, or do you only take cash?"),
                            ("Bob", "Card is absolutely fine. Just tap here whenever you're ready."),
                            ("Sophie", "There we go. Thank you very much."),
                            ("Bob", "Thank you! Have a lovely day."),
                        ],
                        "exercises": [
                            _mc(
                                "Paying",
                                "Choose the right question.",
                                "You want to use your card. What do you ask?",
                                "Can I pay by card?",
                                "Where do you live?",
                            )
                        ],
                    }
                ],
            },
        ],
    },
    {
        "slug": "food-and-cafes-a2",
        "title": "Food and Cafes (A2)",
        "level": "A2",
        "order": 5,
        "description": "Elementary English for ordering food and drinks and chatting over a meal. "
        "Listen, study the transcript, then pass each lesson with a Live Role-play.",
        "cover": {"c1": "#D98E5A", "c2": "#B5653A", "icon": "coffee"},
        "sections": [
            {
                "slug": "ordering-coffee",
                "title": "Ordering a Coffee",
                "description": "Order your favorite drink.",
                "lessons": [
                    {
                        "slug": "a-coffee-please",
                        "title": "A Coffee, Please",
                        "description": "Ordering a coffee at the counter.",
                        "background": "cafe",
                        "characters": ["Lisa", "Jake"],
                        "lines": [
                            ("Jake", "Hi there! What can I get for you today?"),
                            ("Lisa", "Hi, could I have a small coffee, please?"),
                            ("Jake", "Sure. Would you like any milk or sugar with that?"),
                            ("Lisa", "Just a little milk, please, but no sugar."),
                            ("Jake", "No problem. Is that to stay or to take away?"),
                            ("Lisa", "To take away, please. I'm in a bit of a hurry."),
                        ],
                        "exercises": [_fb("Coffee order", "Complete the order.", "A small coffee, ___.", "please")],
                    }
                ],
            },
            {
                "slug": "lunch-spot",
                "title": "At the Lunch Spot",
                "description": "Choose a quick lunch.",
                "lessons": [
                    {
                        "slug": "what-do-you-recommend",
                        "title": "What Do You Recommend?",
                        "description": "Asking for a lunch recommendation.",
                        "background": "cafe",
                        "characters": ["Lisa", "Jake"],
                        "lines": [
                            ("Lisa", "Everything looks good. What would you recommend?"),
                            ("Jake", "The tomato soup is really popular today, and it's freshly made."),
                            ("Lisa", "That sounds perfect. I'll have a bowl of that, then."),
                            ("Jake", "Great. Would you like some warm bread with it?"),
                            ("Lisa", "Yes, please. That would be lovely."),
                            ("Jake", "Coming right up. Take a seat and I'll bring it over."),
                        ],
                        "exercises": [
                            _mc(
                                "Recommendation",
                                "Pick the best question.",
                                "You want a suggestion. What do you ask?",
                                "What do you recommend?",
                                "How old are you?",
                            )
                        ],
                    }
                ],
            },
            {
                "slug": "dietary-needs",
                "title": "Dietary Needs",
                "description": "Explain what you can and can't eat.",
                "lessons": [
                    {
                        "slug": "im-vegetarian",
                        "title": "I'm Vegetarian",
                        "description": "Asking about ingredients politely.",
                        "background": "cafe",
                        "characters": ["Lisa", "Jake"],
                        "lines": [
                            ("Lisa", "Excuse me, is this dish suitable for vegetarians?"),
                            ("Jake", "Yes, it is. There's no meat or fish in it at all."),
                            ("Lisa", "That's great, because I'm vegetarian."),
                            ("Jake", "No problem. Do you also need it to be dairy-free?"),
                            ("Lisa", "No, a little cheese is fine. Thank you for checking."),
                            ("Jake", "You're welcome. I'll make sure the kitchen knows."),
                        ],
                        "exercises": [_fb("Dietary", "Complete the sentence.", "Is this dish ___?", "vegetarian")],
                    }
                ],
            },
            {
                "slug": "paying-the-bill",
                "title": "Paying the Bill",
                "description": "Ask for and split the bill.",
                "lessons": [
                    {
                        "slug": "the-bill-please",
                        "title": "The Bill, Please",
                        "description": "Paying after a meal with a friend.",
                        "background": "cafe",
                        "characters": ["Lisa", "Jake"],
                        "lines": [
                            ("Lisa", "That was delicious. Could we have the bill, please?"),
                            ("Jake", "Of course, here you are. I hope you enjoyed everything."),
                            ("Lisa", "We did, thank you. Is it okay if we split it?"),
                            ("Jake", "Not a problem at all. That's ten dollars each."),
                            ("Lisa", "Perfect. Here's my half, and thank you again."),
                            ("Jake", "Thank you both. Do come back soon!"),
                        ],
                        "exercises": [
                            _mc(
                                "The bill",
                                "Choose the polite request.",
                                "You finished eating. What do you say?",
                                "Could we have the bill, please?",
                                "Give me food.",
                            )
                        ],
                    }
                ],
            },
            {
                "slug": "inviting-a-friend",
                "title": "Inviting a Friend",
                "description": "Invite someone for a coffee.",
                "lessons": [
                    {
                        "slug": "lets-grab-a-coffee",
                        "title": "Let's Grab a Coffee",
                        "description": "Inviting a colleague out for coffee.",
                        "background": "company2-breakroom",
                        "characters": ["Lisa", "Jake"],
                        "lines": [
                            ("Lisa", "Are you busy right now, or shall we grab a coffee?"),
                            ("Jake", "I've got half an hour, so a coffee sounds great."),
                            ("Lisa", "There's a lovely little cafe just around the corner."),
                            ("Jake", "Perfect. Let me get this round. It's my treat today."),
                            ("Lisa", "That's kind of you! Next time it's on me, then."),
                            ("Jake", "Deal. Let's go before the queue gets too long."),
                        ],
                        "exercises": [_fb("Invitation", "Complete the invitation.", "Let's ___ a coffee.", "grab")],
                    }
                ],
            },
        ],
    },
    {
        "slug": "first-days-at-work-a2",
        "title": "First Days at Work (A2)",
        "level": "A2",
        "order": 6,
        "description": "Elementary workplace English for your first days: meeting the team and finding your way. "
        "Listen, study the transcript, then pass each lesson with a Live Role-play.",
        "cover": {"c1": "#2D6A4F", "c2": "#1B4332", "icon": "briefcase"},
        "sections": [
            {
                "slug": "meeting-the-team",
                "title": "Meeting the Team",
                "description": "Introduce yourself to colleagues.",
                "lessons": [
                    {
                        "slug": "this-is-my-first-day",
                        "title": "This Is My First Day",
                        "description": "A new starter meets the team.",
                        "background": "company1-reception",
                        "characters": ["Sarah", "Brian"],
                        "lines": [
                            ("Sarah", "Hi, I'm Sarah. Today is my first day on the team."),
                            ("Brian", "Welcome aboard, Sarah! I'm Brian, the team lead."),
                            ("Sarah", "It's great to meet you. I'm a little nervous, I must admit."),
                            ("Brian", "That's completely normal. Everyone felt the same at first."),
                            ("Sarah", "Thank you. That makes me feel much better."),
                            ("Brian", "Come on, let me introduce you to the rest of the team."),
                        ],
                        "exercises": [_fb("First day", "Complete the introduction.", "It's my ___ day.", "first")],
                    }
                ],
            },
            {
                "slug": "office-tour",
                "title": "Office Tour",
                "description": "Learn where everything is.",
                "lessons": [
                    {
                        "slug": "the-office-tour",
                        "title": "The Office Tour",
                        "description": "Brian shows Sarah around.",
                        "background": "company2-center",
                        "characters": ["Sarah", "Brian"],
                        "lines": [
                            ("Brian", "Let me show you around. This is our little kitchen."),
                            ("Sarah", "Nice. And where are the meeting rooms?"),
                            ("Brian", "They're just down the hall, on the left."),
                            ("Sarah", "Good to know. What about the restrooms?"),
                            ("Brian", "Those are past the kitchen, on the right-hand side."),
                            ("Sarah", "Thanks, Brian. This is really helpful."),
                        ],
                        "exercises": [
                            _mc(
                                "Office tour",
                                "Pick the right question.",
                                "You can't find the meeting rooms. What do you ask?",
                                "Where are the meeting rooms?",
                                "What time is lunch yesterday?",
                            )
                        ],
                    }
                ],
            },
            {
                "slug": "your-workspace",
                "title": "Your Workspace",
                "description": "Get set up at your desk.",
                "lessons": [
                    {
                        "slug": "setting-up-my-desk",
                        "title": "Setting Up My Desk",
                        "description": "Getting a laptop and login details.",
                        "background": "company2-center",
                        "characters": ["Sarah", "Brian"],
                        "lines": [
                            ("Sarah", "Where would you like me to sit?"),
                            ("Brian", "This desk by the window is all yours."),
                            ("Sarah", "Lovely, it has a great view. Do I have a laptop?"),
                            ("Brian", "Yes, it's in the top drawer, and here are your login details."),
                            ("Sarah", "Perfect. Who should I ask if I have any IT problems?"),
                            ("Brian", "Just message the support team, or come and find me."),
                        ],
                        "exercises": [_fb("Workspace", "Complete the question.", "Where can I ___?", "sit")],
                    }
                ],
            },
            {
                "slug": "daily-schedule",
                "title": "Daily Schedule",
                "description": "Learn the team's daily routine.",
                "lessons": [
                    {
                        "slug": "when-do-we-start",
                        "title": "When Do We Start?",
                        "description": "Asking about work hours and breaks.",
                        "background": "company2-breakroom",
                        "characters": ["Sarah", "Brian"],
                        "lines": [
                            ("Sarah", "What time does the team usually start in the morning?"),
                            ("Brian", "Most of us get in around nine, but we're fairly flexible."),
                            ("Sarah", "Good to know. And when do people take lunch?"),
                            ("Brian", "Usually around half past twelve, for about an hour."),
                            ("Sarah", "Great. Is there a stand-up meeting every day?"),
                            ("Brian", "Yes, a short one at ten. It only takes ten minutes."),
                        ],
                        "exercises": [
                            _mc(
                                "Schedule",
                                "Choose the right question.",
                                "You want to know the start time. What do you ask?",
                                "What time do we start?",
                                "Why is the sky blue?",
                            )
                        ],
                    }
                ],
            },
            {
                "slug": "asking-questions",
                "title": "Asking Questions",
                "description": "Ask when you don't understand.",
                "lessons": [
                    {
                        "slug": "i-dont-understand",
                        "title": "I Don't Understand",
                        "description": "Politely asking for an explanation.",
                        "background": "company2-center",
                        "characters": ["Sarah", "David"],
                        "lines": [
                            ("Sarah", "Sorry, David, I don't quite understand this task."),
                            ("David", "No problem at all. Which part isn't clear?"),
                            ("Sarah", "The second step, mainly. What should I do there?"),
                            ("David", "First you save the file, and then you send it to me for review."),
                            ("Sarah", "Ah, that makes sense now. Thank you for explaining."),
                            ("David", "Anytime. It's always better to ask than to guess."),
                        ],
                        "exercises": [
                            _fb("Clarify", "Complete the polite phrase.", "Sorry, I don't ___ this task.", "understand")
                        ],
                    }
                ],
            },
        ],
    },
    {
        "slug": "daily-routines-a2",
        "title": "Daily Routines and Plans (A2)",
        "level": "A2",
        "order": 7,
        "description": "Elementary English for talking about your day, your plans and your habits. "
        "Listen, study the transcript, then pass each lesson with a Live Role-play.",
        "cover": {"c1": "#E76F51", "c2": "#F4A261", "icon": "calendar"},
        "sections": [
            {
                "slug": "talking-about-your-day",
                "title": "Talking About Your Day",
                "description": "Describe your daily routine.",
                "lessons": [
                    {
                        "slug": "my-morning-routine",
                        "title": "My Morning Routine",
                        "description": "Chatting about morning habits.",
                        "background": "company2-breakroom",
                        "characters": ["Anna", "David"],
                        "lines": [
                            ("David", "You're always so early, Anna. What time do you get up?"),
                            ("Anna", "I usually get up at six and go for a short run."),
                            ("David", "Wow, that's impressive. What do you do after that?"),
                            ("Anna", "I make some breakfast and read the news for a while."),
                            ("David", "That sounds like a really healthy way to start the day."),
                            ("Anna", "It is. A calm morning helps me focus at work."),
                        ],
                        "exercises": [_fb("Routine", "Complete the question.", "What time do you ___ up?", "get")],
                    }
                ],
            },
            {
                "slug": "making-plans",
                "title": "Making Plans",
                "description": "Plan something with a friend.",
                "lessons": [
                    {
                        "slug": "are-you-free-friday",
                        "title": "Are You Free Friday?",
                        "description": "Planning to meet on Friday.",
                        "background": "company2-breakroom",
                        "characters": ["Anna", "David"],
                        "lines": [
                            ("Anna", "Are you free on Friday evening, by any chance?"),
                            ("David", "I think so. What did you have in mind?"),
                            ("Anna", "I thought we could see a movie after work."),
                            ("David", "That sounds fun. What time were you thinking?"),
                            ("Anna", "Maybe around seven? I can book the tickets online."),
                            ("David", "Seven works for me. Thanks for organizing it!"),
                        ],
                        "exercises": [
                            _mc(
                                "Plans",
                                "Pick the best question.",
                                "You want to make plans for Friday. What do you ask?",
                                "Are you free on Friday?",
                                "Are you a robot?",
                            )
                        ],
                    }
                ],
            },
            {
                "slug": "the-weekend",
                "title": "The Weekend",
                "description": "Talk about weekend plans.",
                "lessons": [
                    {
                        "slug": "weekend-plans",
                        "title": "Weekend Plans",
                        "description": "Sharing plans for the weekend.",
                        "background": "company2-roof",
                        "characters": ["Anna", "David"],
                        "lines": [
                            ("David", "Have you got any plans for the weekend?"),
                            ("Anna", "Yes, I'm visiting my family down by the coast."),
                            ("David", "That sounds relaxing. Do they live far away?"),
                            ("Anna", "About two hours by train, so it's not too bad."),
                            ("David", "Lovely. I hope you get some nice weather."),
                            ("Anna", "Me too! Have a great weekend yourself, David."),
                        ],
                        "exercises": [_fb("Weekend", "Complete the question.", "Any ___ for the weekend?", "plans")],
                    }
                ],
            },
            {
                "slug": "time-and-schedules",
                "title": "Time & Schedules",
                "description": "Talk about times and dates.",
                "lessons": [
                    {
                        "slug": "what-time-is-it",
                        "title": "What Time Is It?",
                        "description": "Checking the time before a meeting.",
                        "background": "company2-center",
                        "characters": ["Anna", "David"],
                        "lines": [
                            ("Anna", "Quick question, what time is the team meeting?"),
                            ("David", "It's at half past two, in the big room."),
                            ("Anna", "Oh, it's already two o'clock. We should get ready."),
                            ("David", "You're right. Let's grab our laptops and head over."),
                            ("Anna", "Good idea. I don't want to be late again."),
                            ("David", "Don't worry, we've still got plenty of time."),
                        ],
                        "exercises": [
                            _mc(
                                "Time",
                                "Choose the right phrase.",
                                "You want to know the meeting time. What do you ask?",
                                "What time is the meeting?",
                                "How much is the meeting?",
                            )
                        ],
                    }
                ],
            },
            {
                "slug": "health-and-habits",
                "title": "Health & Habits",
                "description": "Talk about healthy habits.",
                "lessons": [
                    {
                        "slug": "staying-healthy",
                        "title": "Staying Healthy",
                        "description": "Sharing simple healthy habits.",
                        "background": "company2-roof",
                        "characters": ["Anna", "David"],
                        "lines": [
                            ("David", "I don't know how you stay so healthy, Anna."),
                            ("Anna", "It's nothing special. I drink lots of water and walk every day."),
                            ("David", "Maybe I should start walking more, too."),
                            ("Anna", "Let's take the stairs instead of the lift from now on."),
                            ("David", "Good idea. Small changes really do add up, don't they?"),
                            ("Anna", "Exactly. Let's start today and see how we feel."),
                        ],
                        "exercises": [
                            _fb("Habits", "Complete the sentence.", "I ___ a lot of water every day.", "drink")
                        ],
                    }
                ],
            },
        ],
    },
    # ===================== B1 =====================
    {
        "slug": "meetings-and-teamwork-b1",
        "title": "Meetings and Teamwork (B1)",
        "level": "B1",
        "order": 8,
        "description": "Intermediate workplace English for meetings, updates and working as a team. "
        "Listen, study the transcript, then pass each lesson with a Live Role-play.",
        "cover": {"c1": "#3A0CA3", "c2": "#7209B7", "icon": "users"},
        "sections": [
            {
                "slug": "starting-a-meeting",
                "title": "Starting a Meeting",
                "description": "Open a meeting and set the agenda.",
                "lessons": [
                    {
                        "slug": "lets-get-started",
                        "title": "Let's Get Started",
                        "description": "Kicking off a team stand-up.",
                        "background": "company2-boardroom",
                        "characters": ["Maria", "James"],
                        "lines": [
                            ("Maria", "Thanks for joining, everyone. Let's get started so we finish on time."),
                            ("James", "Sounds good. Could you remind us what's on the agenda today?"),
                            ("Maria", "Sure. We'll review last week's progress and then plan this sprint."),
                            ("James", "Great. Shall I share my screen so everyone can follow along?"),
                            ("Maria", "Yes, please go ahead. We'll start with the demo."),
                            ("James", "Perfect, just give me one second to bring it up."),
                        ],
                        "exercises": [
                            _fb("Opening", "Complete the phrase.", "Thanks for joining. Let's get ___.", "started")
                        ],
                    }
                ],
            },
            {
                "slug": "sharing-updates",
                "title": "Sharing Updates",
                "description": "Give a clear status update.",
                "lessons": [
                    {
                        "slug": "my-progress-update",
                        "title": "My Progress Update",
                        "description": "Reporting progress and a blocker.",
                        "background": "company2-boardroom",
                        "characters": ["Maria", "James"],
                        "lines": [
                            ("Maria", "James, would you mind giving us a quick update on your work?"),
                            ("James", "Of course. I finished the login page yesterday, and it's now in review."),
                            ("Maria", "That's great progress. Is anything currently blocking you?"),
                            ("James", "Yes, I'm still waiting on the API from the backend team."),
                            ("Maria", "Understood. I'll follow up with them straight after this meeting."),
                            ("James", "Thanks, that would really help me move forward."),
                        ],
                        "exercises": [
                            _mc(
                                "Updates",
                                "Choose the clearest update.",
                                "How do you report a blocker?",
                                "I'm waiting for the API from the backend team.",
                                "Everything is a secret.",
                            )
                        ],
                    }
                ],
            },
            {
                "slug": "agree-disagree",
                "title": "Agreeing & Disagreeing",
                "description": "Share your opinion politely.",
                "lessons": [
                    {
                        "slug": "i-see-your-point",
                        "title": "I See Your Point",
                        "description": "Disagreeing in a respectful way.",
                        "background": "company1-boardroom",
                        "characters": ["Maria", "Tom"],
                        "lines": [
                            ("Tom", "Honestly, I think we should just launch next week."),
                            ("Maria", "I see your point, but the testing isn't finished yet."),
                            ("Tom", "That's true. So what would you suggest instead?"),
                            ("Maria", "Let's aim for the week after, so we can release with confidence."),
                            ("Tom", "Okay, that actually makes a lot of sense."),
                            ("Maria", "Great. I'm glad we're on the same page."),
                        ],
                        "exercises": [
                            _fb(
                                "Disagree politely",
                                "Complete the phrase.",
                                "I ___ your point, but the testing isn't finished.",
                                "see",
                            )
                        ],
                    }
                ],
            },
            {
                "slug": "assigning-tasks",
                "title": "Assigning Tasks",
                "description": "Agree who does what.",
                "lessons": [
                    {
                        "slug": "who-will-do-this",
                        "title": "Who Will Do This?",
                        "description": "Dividing the work fairly.",
                        "background": "company2-boardroom",
                        "characters": ["Maria", "James"],
                        "lines": [
                            ("Maria", "So, who would be happy to take on the documentation?"),
                            ("James", "I can handle that. I should have it done by Thursday."),
                            ("Maria", "Perfect, thank you. And what about the remaining bug fixes?"),
                            ("James", "Could we ask Tom? He knows that part of the code really well."),
                            ("Maria", "Good thinking. I'll check with him after the meeting."),
                            ("James", "Great. I'll share my notes with him in the meantime."),
                        ],
                        "exercises": [
                            _mc(
                                "Tasks",
                                "Pick the best offer.",
                                "You want to volunteer for a task. What do you say?",
                                "I can do it by Thursday.",
                                "Nobody should do anything.",
                            )
                        ],
                    }
                ],
            },
            {
                "slug": "wrapping-up",
                "title": "Wrapping Up",
                "description": "Summarize and agree next steps.",
                "lessons": [
                    {
                        "slug": "to-sum-up",
                        "title": "To Sum Up",
                        "description": "Closing the meeting with action items.",
                        "background": "company1-boardroom",
                        "characters": ["Maria", "James"],
                        "lines": [
                            ("Maria", "To sum up: James writes the docs, and Tom takes the bug fixes."),
                            ("James", "And you'll chase the backend team about the API, right?"),
                            ("Maria", "Exactly. Let's meet again on Friday to check where we are."),
                            ("James", "Friday works for me. Thanks, everyone, this was productive."),
                            ("Maria", "Agreed. Great work today, and talk soon!"),
                            ("James", "Talk soon. Have a good rest of your day."),
                        ],
                        "exercises": [
                            _fb("Summary", "Complete the phrase.", "To ___ up, James writes the docs.", "sum")
                        ],
                    }
                ],
            },
        ],
    },
    {
        "slug": "client-calls-b1",
        "title": "Client and Customer Calls (B1)",
        "level": "B1",
        "order": 9,
        "description": "Intermediate English for handling client calls: understanding needs and solving problems. "
        "Listen, study the transcript, then pass each lesson with a Live Role-play.",
        "cover": {"c1": "#0096C7", "c2": "#023E8A", "icon": "phone"},
        "sections": [
            {
                "slug": "answering-a-call",
                "title": "Answering a Call",
                "description": "Take a professional phone call.",
                "lessons": [
                    {
                        "slug": "how-can-i-help",
                        "title": "How Can I Help?",
                        "description": "Greeting a client on the phone.",
                        "background": "company2-center",
                        "characters": ["Linda", "Bob"],
                        "lines": [
                            ("Linda", "Good morning, thanks for calling. How can I help you today?"),
                            ("Bob", "Hi, I've got a quick question about an order I placed."),
                            ("Linda", "Of course. Could I take your order number to find it?"),
                            ("Bob", "Yes, it's four-five-six-two."),
                            ("Linda", "Thank you. Just give me a moment to pull that up."),
                            ("Bob", "No problem, take your time."),
                        ],
                        "exercises": [
                            _fb("Greeting", "Complete the phrase.", "Thanks for calling. How can I ___?", "help")
                        ],
                    }
                ],
            },
            {
                "slug": "understanding-needs",
                "title": "Understanding Needs",
                "description": "Ask questions to understand the client.",
                "lessons": [
                    {
                        "slug": "tell-me-more",
                        "title": "Tell Me More",
                        "description": "Clarifying what the client wants.",
                        "background": "company2-center",
                        "characters": ["Linda", "Bob"],
                        "lines": [
                            ("Bob", "The app keeps crashing every time I try to log in."),
                            ("Linda", "I'm really sorry to hear that. Could you tell me a bit more?"),
                            ("Bob", "It happens the moment I enter my password and tap 'sign in'."),
                            ("Linda", "I understand. And which phone are you using, if I may ask?"),
                            ("Bob", "It's an older Android model, a couple of years old."),
                            ("Linda", "Thank you, that's really helpful. It gives me a good starting point."),
                        ],
                        "exercises": [
                            _mc(
                                "Clarify",
                                "Choose the best follow-up.",
                                "A client describes a vague problem. What do you say?",
                                "Could you tell me more?",
                                "That is not my job.",
                            )
                        ],
                    }
                ],
            },
            {
                "slug": "explaining-a-solution",
                "title": "Explaining a Solution",
                "description": "Explain the next steps clearly.",
                "lessons": [
                    {
                        "slug": "heres-what-well-do",
                        "title": "Here's What We'll Do",
                        "description": "Offering a clear solution.",
                        "background": "company2-center",
                        "characters": ["Linda", "Bob"],
                        "lines": [
                            ("Linda", "Right, here's what we'll do to get this sorted for you."),
                            ("Bob", "Okay, I'm listening. When will it be fixed?"),
                            ("Linda", "I'll send you an update to install, ready by tomorrow morning."),
                            ("Bob", "And you're confident that will stop the crashing?"),
                            ("Linda", "Yes, this update targets exactly that problem, so it should solve it."),
                            ("Bob", "That's a relief. Thank you for explaining it so clearly."),
                        ],
                        "exercises": [_fb("Solution", "Complete the phrase.", "Here's what we'll ___.", "do")],
                    }
                ],
            },
            {
                "slug": "handling-complaints",
                "title": "Handling Complaints",
                "description": "Stay calm and helpful.",
                "lessons": [
                    {
                        "slug": "i-understand-your-frustration",
                        "title": "I Understand Your Frustration",
                        "description": "Calming an unhappy customer.",
                        "background": "company2-center",
                        "characters": ["Linda", "Bob"],
                        "lines": [
                            ("Bob", "This is the third time I've had to call. It's really frustrating."),
                            ("Linda", "I completely understand your frustration, and I'm sorry for the trouble."),
                            ("Bob", "I just want this fixed once and for all."),
                            ("Linda", "Absolutely. I'll take ownership of this myself and follow it through today."),
                            ("Bob", "Thank you. I really appreciate you taking it seriously."),
                            ("Linda", "Of course. You have my word that I'll keep you updated."),
                        ],
                        "exercises": [
                            _mc(
                                "Empathy",
                                "Pick the best calming reply.",
                                "A customer is upset. What do you say first?",
                                "I completely understand your frustration.",
                                "Calm down, it's nothing.",
                            )
                        ],
                    }
                ],
            },
            {
                "slug": "following-up",
                "title": "Following Up",
                "description": "Confirm and close the call.",
                "lessons": [
                    {
                        "slug": "ill-follow-up",
                        "title": "I'll Follow Up",
                        "description": "Ending the call with clear next steps.",
                        "background": "company2-center",
                        "characters": ["Linda", "Bob"],
                        "lines": [
                            ("Linda", "Just to confirm, I'll email you the update first thing tomorrow."),
                            ("Bob", "Perfect. Thank you so much for all your help today."),
                            ("Linda", "You're very welcome. Is there anything else I can do for you?"),
                            ("Bob", "No, that's everything. You've been great."),
                            ("Linda", "That's very kind of you to say. Have a wonderful day. Goodbye!"),
                            ("Bob", "You too. Goodbye!"),
                        ],
                        "exercises": [
                            _fb("Follow up", "Complete the phrase.", "To ___, I'll email you tomorrow.", "confirm")
                        ],
                    }
                ],
            },
        ],
    },
    {
        "slug": "travel-and-appointments-b1",
        "title": "Travel and Appointments (B1)",
        "level": "B1",
        "order": 10,
        "description": "Intermediate English for booking trips, travelling and arranging appointments. "
        "Listen, study the transcript, then pass each lesson with a Live Role-play.",
        "cover": {"c1": "#4361EE", "c2": "#4895EF", "icon": "plane"},
        "sections": [
            {
                "slug": "booking-a-trip",
                "title": "Booking a Trip",
                "description": "Book a flight or hotel.",
                "lessons": [
                    {
                        "slug": "id-like-to-book",
                        "title": "I'd Like to Book",
                        "description": "Booking a business trip.",
                        "background": "company1-reception",
                        "characters": ["Alice", "Jake"],
                        "lines": [
                            ("Alice", "Hi, I'd like to book a flight to Berlin, please."),
                            ("Jake", "Certainly. When were you hoping to travel?"),
                            ("Alice", "Next Monday, and I'd need to come back on Wednesday."),
                            ("Jake", "There's a morning flight at eight on Monday. Would that suit you?"),
                            ("Alice", "That's perfect. Could I get a window seat as well?"),
                            ("Jake", "Of course. I'll add that to your booking now."),
                        ],
                        "exercises": [
                            _fb("Booking", "Complete the phrase.", "I'd like to ___ a flight to Berlin.", "book")
                        ],
                    }
                ],
            },
            {
                "slug": "at-the-airport",
                "title": "At the Airport",
                "description": "Get through the airport.",
                "lessons": [
                    {
                        "slug": "where-is-the-gate",
                        "title": "Where Is the Gate?",
                        "description": "Finding the boarding gate.",
                        "background": "company2-parking",
                        "characters": ["Alice", "Jake"],
                        "lines": [
                            ("Alice", "Excuse me, could you tell me where gate twelve is?"),
                            ("Jake", "Sure. Go through security and then turn right at the end."),
                            ("Alice", "Thank you. Do you know if the flight is on time?"),
                            ("Jake", "Yes, it is. Boarding should start in about twenty minutes."),
                            ("Alice", "Great, that gives me time to grab a coffee."),
                            ("Jake", "Good idea. The gate isn't far, so you won't have to rush."),
                        ],
                        "exercises": [
                            _mc(
                                "Airport",
                                "Choose the right question.",
                                "You can't find your gate. What do you ask?",
                                "Where is gate twelve?",
                                "What is your favorite color?",
                            )
                        ],
                    }
                ],
            },
            {
                "slug": "checking-in",
                "title": "Checking In",
                "description": "Check in at a hotel.",
                "lessons": [
                    {
                        "slug": "i-have-a-reservation",
                        "title": "I Have a Reservation",
                        "description": "Checking in at the hotel desk.",
                        "background": "company3-reception",
                        "characters": ["Alice", "Jake"],
                        "lines": [
                            ("Alice", "Good evening. I have a reservation under the name Alice Carter."),
                            ("Jake", "Welcome. Could I see your ID and a card for the deposit, please?"),
                            ("Alice", "Here you are. Is breakfast included with the room?"),
                            ("Jake", "It is. You're in room three-oh-five, and breakfast runs from seven to ten."),
                            ("Alice", "Lovely. Is there wifi in the rooms?"),
                            ("Jake", "Yes, the password is on your key card. Enjoy your stay."),
                        ],
                        "exercises": [
                            _fb("Check-in", "Complete the phrase.", "I have a ___ under Alice Carter.", "reservation")
                        ],
                    }
                ],
            },
            {
                "slug": "making-appointments",
                "title": "Making Appointments",
                "description": "Arrange a meeting time.",
                "lessons": [
                    {
                        "slug": "can-we-schedule",
                        "title": "Can We Schedule a Meeting?",
                        "description": "Setting up an appointment.",
                        "background": "company2-center",
                        "characters": ["Alice", "Jake"],
                        "lines": [
                            ("Alice", "Could we schedule a meeting sometime this week?"),
                            ("Jake", "Of course. Would Thursday work for you?"),
                            ("Alice", "Thursday morning would be ideal, if that's possible."),
                            ("Jake", "Let's say ten o'clock, then. Shall I book a room?"),
                            ("Alice", "Perfect. I'll send a calendar invite to confirm."),
                            ("Jake", "Great. I'll make sure to keep that slot free."),
                        ],
                        "exercises": [
                            _mc(
                                "Appointments",
                                "Pick the best phrase.",
                                "You want to arrange a meeting. What do you say?",
                                "Can we schedule a meeting this week?",
                                "Meetings are forbidden.",
                            )
                        ],
                    }
                ],
            },
            {
                "slug": "changing-plans",
                "title": "Changing Plans",
                "description": "Reschedule politely.",
                "lessons": [
                    {
                        "slug": "can-we-reschedule",
                        "title": "Can We Reschedule?",
                        "description": "Moving an appointment to another day.",
                        "background": "company2-center",
                        "characters": ["Alice", "Jake"],
                        "lines": [
                            ("Alice", "I'm really sorry, but would it be possible to reschedule our meeting?"),
                            ("Jake", "No problem at all. What day would suit you better?"),
                            ("Alice", "Could we possibly move it to Friday instead?"),
                            ("Jake", "Friday at the same time works perfectly for me."),
                            ("Alice", "Thank you so much for being flexible."),
                            ("Jake", "Don't mention it. These things happen to all of us."),
                        ],
                        "exercises": [
                            _fb("Reschedule", "Complete the phrase.", "Can we ___ our meeting?", "reschedule")
                        ],
                    }
                ],
            },
        ],
    },
    {
        "slug": "everyday-problems-b1",
        "title": "Solving Everyday Problems (B1)",
        "level": "B1",
        "order": 11,
        "description": "Intermediate English for reporting issues, asking for refunds and getting things fixed. "
        "Listen, study the transcript, then pass each lesson with a Live Role-play.",
        "cover": {"c1": "#6D597A", "c2": "#B56576", "icon": "wrench"},
        "sections": [
            {
                "slug": "reporting-an-issue",
                "title": "Reporting an Issue",
                "description": "Describe a problem clearly.",
                "lessons": [
                    {
                        "slug": "theres-a-problem",
                        "title": "There's a Problem",
                        "description": "Reporting a broken item.",
                        "background": "company2-center",
                        "characters": ["Sarah", "Tom"],
                        "lines": [
                            ("Sarah", "Hi Tom, I'm afraid there's a problem with my laptop."),
                            ("Tom", "Oh no, I'm sorry to hear that. What seems to be wrong?"),
                            ("Sarah", "The screen keeps going completely black for no reason."),
                            ("Tom", "That's frustrating. When did it first start happening?"),
                            ("Sarah", "This morning, right after I installed the latest update."),
                            ("Tom", "Okay, that's a useful clue. Let's take a look together."),
                        ],
                        "exercises": [
                            _fb("Report", "Complete the phrase.", "There's a ___ with my laptop.", "problem")
                        ],
                    }
                ],
            },
            {
                "slug": "asking-for-a-refund",
                "title": "Asking for a Refund",
                "description": "Request a refund politely.",
                "lessons": [
                    {
                        "slug": "id-like-a-refund",
                        "title": "I'd Like a Refund",
                        "description": "Returning a faulty product.",
                        "background": "company3-reception",
                        "characters": ["Sarah", "Tom"],
                        "lines": [
                            ("Sarah", "Hi, I'd like to ask for a refund on this item, please."),
                            ("Tom", "Of course. May I ask what the problem was?"),
                            ("Sarah", "It stopped working after just one day, unfortunately."),
                            ("Tom", "I'm sorry about that. Do you happen to have the receipt?"),
                            ("Sarah", "Yes, I've got it right here."),
                            ("Tom", "Thank you. I'll process the refund for you straight away."),
                        ],
                        "exercises": [
                            _mc(
                                "Refund",
                                "Choose the polite request.",
                                "A product is faulty. What do you say?",
                                "I'd like a refund for this item, please.",
                                "Give me money now.",
                            )
                        ],
                    }
                ],
            },
            {
                "slug": "getting-things-fixed",
                "title": "Getting Things Fixed",
                "description": "Arrange a repair.",
                "lessons": [
                    {
                        "slug": "can-you-fix-it",
                        "title": "Can You Fix It?",
                        "description": "Asking about a repair and the cost.",
                        "background": "company2-center",
                        "characters": ["Sarah", "Tom"],
                        "lines": [
                            ("Sarah", "Do you think you can fix it, or do I need a new one?"),
                            ("Tom", "From what I can see, I think we can repair it."),
                            ("Sarah", "That's good news. How much is it likely to cost?"),
                            ("Tom", "It's completely free, since it's still under warranty."),
                            ("Sarah", "Oh, that's a real relief. Thank you so much."),
                            ("Tom", "No problem. It should be ready by the end of the day."),
                        ],
                        "exercises": [_fb("Repair", "Complete the question.", "How much will it ___?", "cost")],
                    }
                ],
            },
            {
                "slug": "tech-support",
                "title": "Tech Support",
                "description": "Follow simple troubleshooting steps.",
                "lessons": [
                    {
                        "slug": "have-you-tried",
                        "title": "Have You Tried Restarting?",
                        "description": "Walking through troubleshooting steps.",
                        "background": "company2-center",
                        "characters": ["Sarah", "Tom"],
                        "lines": [
                            ("Tom", "Before we do anything else, have you tried restarting the computer?"),
                            ("Sarah", "Yes, I have, but unfortunately it didn't make any difference."),
                            ("Tom", "Alright. Could you check that the cable at the back is firmly in?"),
                            ("Sarah", "Oh, you're right, it was a bit loose. It's working now!"),
                            ("Tom", "Brilliant. That was almost certainly the cause."),
                            ("Sarah", "Thank you. I would never have thought to check that."),
                        ],
                        "exercises": [
                            _mc(
                                "Troubleshooting",
                                "Pick the best first step.",
                                "Tech support usually suggests what first?",
                                "Have you tried restarting the computer?",
                                "Throw it away.",
                            )
                        ],
                    }
                ],
            },
            {
                "slug": "asking-for-advice",
                "title": "Asking for Advice",
                "description": "Ask a colleague what to do.",
                "lessons": [
                    {
                        "slug": "what-would-you-do",
                        "title": "What Would You Do?",
                        "description": "Getting advice on a tricky situation.",
                        "background": "company2-breakroom",
                        "characters": ["Sarah", "Tom"],
                        "lines": [
                            ("Sarah", "I'm not sure how to reply to this email. What would you do?"),
                            ("Tom", "I'd keep it short, polite, and to the point."),
                            ("Sarah", "Do you think I should apologize for the delay?"),
                            ("Tom", "Yes, a quick apology never hurts and shows that you care."),
                            ("Sarah", "That makes sense. Thanks, that's really helpful advice."),
                            ("Tom", "Anytime. Feel free to show me the draft before you send it."),
                        ],
                        "exercises": [_fb("Advice", "Complete the question.", "What ___ you do?", "would")],
                    }
                ],
            },
        ],
    },
    # ===================== B2 =====================
    {
        "slug": "professional-communication-b2",
        "title": "Professional Communication (B2)",
        "level": "B2",
        "order": 12,
        "description": "Upper-intermediate English for presenting, negotiating and giving feedback at work. "
        "Listen, study the transcript, then pass each lesson with a Live Role-play.",
        "cover": {"c1": "#1D3557", "c2": "#457B9D", "icon": "deck"},
        "sections": [
            {
                "slug": "giving-a-presentation",
                "title": "Giving a Presentation",
                "description": "Open and structure a presentation.",
                "lessons": [
                    {
                        "slug": "todays-agenda",
                        "title": "Today's Agenda",
                        "description": "Opening a presentation with confidence.",
                        "background": "company2-boardroom",
                        "characters": ["Maria", "Brian"],
                        "lines": [
                            (
                                "Maria",
                                "Good morning, everyone. Today I'll walk you through our results from last quarter.",
                            ),
                            ("Brian", "Sounds good. Roughly how long do you think it will take?"),
                            ("Maria", "About fifteen minutes, and then we'll open the floor for questions."),
                            ("Brian", "Perfect. That leaves us plenty of time to discuss afterwards."),
                            ("Maria", "Exactly. Let's begin with the three highlights that stood out most."),
                            ("Brian", "Please go ahead, we're all listening."),
                        ],
                        "exercises": [
                            _fb("Presenting", "Complete the phrase.", "Today I'll walk you ___ our results.", "through")
                        ],
                    }
                ],
            },
            {
                "slug": "negotiating",
                "title": "Negotiating",
                "description": "Find a deal that works for both sides.",
                "lessons": [
                    {
                        "slug": "meeting-in-the-middle",
                        "title": "Meeting in the Middle",
                        "description": "Negotiating a deadline and scope.",
                        "background": "company1-boardroom",
                        "characters": ["Maria", "Brian"],
                        "lines": [
                            ("Brian", "Realistically, we really need this delivered by the first of the month."),
                            ("Maria", "I understand, but that timeline is very tight for the full scope."),
                            ("Brian", "Is there any way we could make it work?"),
                            ("Maria", "If we trim a few non-essential features, the third becomes achievable."),
                            ("Brian", "Let's meet in the middle, then: core features by the third."),
                            ("Maria", "That works for me. I appreciate your flexibility on this."),
                        ],
                        "exercises": [
                            _mc(
                                "Negotiation",
                                "Choose the collaborative phrase.",
                                "You want a compromise. What do you say?",
                                "Let's meet in the middle.",
                                "It's my way only.",
                            )
                        ],
                    }
                ],
            },
            {
                "slug": "giving-feedback",
                "title": "Giving Feedback",
                "description": "Give honest, constructive feedback.",
                "lessons": [
                    {
                        "slug": "constructive-feedback",
                        "title": "Constructive Feedback",
                        "description": "Balancing praise with suggestions.",
                        "background": "company2-center",
                        "characters": ["Maria", "Linda"],
                        "lines": [
                            ("Maria", "I read your report, and overall it was really thorough. Well done."),
                            ("Linda", "Thank you. I wasn't entirely sure about the structure, to be honest."),
                            (
                                "Maria",
                                "The content is solid. My one suggestion would be to add a short summary at the top.",
                            ),
                            ("Linda", "That's a good idea. It would help busy readers get the gist quickly."),
                            ("Maria", "Exactly. Other than that, it's genuinely strong work."),
                            ("Linda", "Thanks, Maria. I'll make that change this afternoon."),
                        ],
                        "exercises": [
                            _fb(
                                "Feedback",
                                "Complete the phrase.",
                                "One ___: add a short summary at the top.",
                                "suggestion",
                            )
                        ],
                    }
                ],
            },
            {
                "slug": "leading-a-discussion",
                "title": "Leading a Discussion",
                "description": "Keep a discussion on track.",
                "lessons": [
                    {
                        "slug": "lets-stay-on-topic",
                        "title": "Let's Stay on Topic",
                        "description": "Guiding a discussion back on track.",
                        "background": "company1-boardroom",
                        "characters": ["Maria", "Brian"],
                        "lines": [
                            ("Brian", "And that actually reminds me of last year's budget situation..."),
                            ("Maria", "That's a fair point, Brian, but let's try to stay on topic for now."),
                            ("Brian", "You're right, sorry. Let's get back to the timeline."),
                            ("Maria", "Thanks. So, what should our next milestone be?"),
                            ("Brian", "I'd say the design review on Monday is the obvious next step."),
                            ("Maria", "Agreed. Let's lock that in and move on."),
                        ],
                        "exercises": [
                            _mc(
                                "Facilitation",
                                "Pick the best phrase to refocus.",
                                "The discussion drifts. What do you say?",
                                "Let's stay on topic.",
                                "I don't care about anything.",
                            )
                        ],
                    }
                ],
            },
            {
                "slug": "writing-follow-ups",
                "title": "Following Up Clearly",
                "description": "Summarize decisions and next steps.",
                "lessons": [
                    {
                        "slug": "ill-summarize",
                        "title": "I'll Summarize the Decisions",
                        "description": "Recapping outcomes after a meeting.",
                        "background": "company2-boardroom",
                        "characters": ["Maria", "Brian"],
                        "lines": [
                            ("Maria", "I'll summarize today's decisions and send them around to everyone."),
                            ("Brian", "Thanks. Could you also note who owns each action item?"),
                            ("Maria", "Of course. I'll list the owners along with their deadlines."),
                            ("Brian", "Perfect. That way nothing slips through the cracks."),
                            ("Maria", "Exactly. You can expect my email by the end of the afternoon."),
                            ("Brian", "Wonderful. Thanks for keeping us all organized, Maria."),
                        ],
                        "exercises": [
                            _fb(
                                "Follow-up",
                                "Complete the phrase.",
                                "I'll ___ the decisions and send them around.",
                                "summarize",
                            )
                        ],
                    }
                ],
            },
        ],
    },
    # ===================== Extra B1/B2 (richer, longer dialogues) =====================
    {
        "slug": "catching-up-with-a-friend-b1",
        "title": "Catching Up with a Friend (B1)",
        "level": "B1",
        "order": 13,
        "description": "Intermediate English for relaxed, friendly catch-ups: sharing news, talking about "
        "work and making plans. Listen, study the transcript, then pass each lesson with a Live Role-play.",
        "cover": {"c1": "#F4845F", "c2": "#D65A31", "icon": "chat"},
        "sections": [
            {
                "slug": "how-have-you-been",
                "title": "How Have You Been?",
                "description": "Reconnect with an old friend.",
                "lessons": [
                    {
                        "slug": "its-been-ages",
                        "title": "It's Been Ages",
                        "description": "Two friends run into each other after a long time.",
                        "background": "cafe",
                        "characters": ["Lisa", "Tom"],
                        "lines": [
                            ("Tom", "Lisa! It's been ages. How have you been keeping?"),
                            ("Lisa", "Honestly, really busy, but good. I actually changed jobs a few months ago."),
                            ("Tom", "No way, that's exciting! What are you doing now?"),
                            ("Lisa", "I'm working as a UX designer at a small startup downtown."),
                            ("Tom", "That suits you perfectly. You always had a good eye for design."),
                            ("Lisa", "Thanks! It's been a big change, but I'm really enjoying it so far."),
                        ],
                        "exercises": [
                            _fb("Catching up", "Complete the question.", "It's been ages. How have you ___?", "been")
                        ],
                    }
                ],
            },
            {
                "slug": "sharing-news",
                "title": "Sharing Some News",
                "description": "React naturally to a friend's news.",
                "lessons": [
                    {
                        "slug": "i-have-some-news",
                        "title": "I Have Some News",
                        "description": "Tom shares some big personal news.",
                        "background": "cafe",
                        "characters": ["Lisa", "Tom"],
                        "lines": [
                            ("Lisa", "So, do you have any news of your own? You look really happy."),
                            ("Tom", "Actually, yes. My partner and I just bought our first apartment."),
                            ("Lisa", "Congratulations! That's a huge step. Whereabouts is it?"),
                            ("Tom", "It's near the river. It's a bit small, but it gets lovely light in the morning."),
                            ("Lisa", "That sounds perfect. You'll have to throw a little housewarming party."),
                            ("Tom", "Definitely. I'll let you know once we've finally unpacked all the boxes."),
                        ],
                        "exercises": [
                            _mc(
                                "Reacting to news",
                                "Pick the most natural reaction.",
                                "A friend says they bought a flat. What do you say?",
                                "Congratulations! That's a huge step.",
                                "Okay, so what?",
                            )
                        ],
                    }
                ],
            },
            {
                "slug": "talking-about-work",
                "title": "How's Work Going?",
                "description": "Talk about work and balance.",
                "lessons": [
                    {
                        "slug": "is-work-treating-you-well",
                        "title": "Is Work Treating You Well?",
                        "description": "Chatting about the new job and switching off.",
                        "background": "cafe",
                        "characters": ["Lisa", "Tom"],
                        "lines": [
                            ("Tom", "How's the new job treating you? Is the team friendly?"),
                            (
                                "Lisa",
                                "Mostly, yes. My manager is supportive, though the deadlines can be pretty tight.",
                            ),
                            ("Tom", "I know that feeling. Are you managing to switch off in the evenings?"),
                            ("Lisa", "I'm trying to. I've started leaving my laptop at the office on Fridays."),
                            ("Tom", "That's a smart rule. It's so easy to let work take over everything."),
                            ("Lisa", "Exactly. I'd much rather protect my weekends than burn myself out."),
                        ],
                        "exercises": [
                            _fb(
                                "Work-life balance",
                                "Complete the phrase.",
                                "Are you managing to ___ off in the evenings?",
                                "switch",
                            )
                        ],
                    }
                ],
            },
            {
                "slug": "making-plans-together",
                "title": "Let's Do Something Soon",
                "description": "Suggest and agree on a plan.",
                "lessons": [
                    {
                        "slug": "lets-plan-something",
                        "title": "Let's Plan Something",
                        "description": "Arranging to meet up again soon.",
                        "background": "cafe",
                        "characters": ["Lisa", "Tom"],
                        "lines": [
                            ("Lisa", "We really shouldn't leave it so long next time. Let's plan something."),
                            ("Tom", "Agreed. There's a new exhibition at the gallery I've been wanting to see."),
                            ("Lisa", "Oh, I'd love that. How about next Saturday afternoon?"),
                            ("Tom", "Saturday works for me. We could grab some lunch beforehand too."),
                            ("Lisa", "Perfect. I'll book a table somewhere and text you the details."),
                            ("Tom", "Sounds like a plan. I'm really glad we ran into each other today."),
                        ],
                        "exercises": [
                            _mc(
                                "Suggesting plans",
                                "Pick the natural suggestion.",
                                "You want to meet next Saturday. What do you say?",
                                "How about next Saturday afternoon?",
                                "You must come on Saturday.",
                            )
                        ],
                    }
                ],
            },
            {
                "slug": "keeping-in-touch",
                "title": "Let's Stay in Touch",
                "description": "End the chat warmly.",
                "lessons": [
                    {
                        "slug": "lets-not-be-strangers",
                        "title": "Let's Not Be Strangers",
                        "description": "Saying goodbye and promising to keep in touch.",
                        "background": "cafe",
                        "characters": ["Lisa", "Tom"],
                        "lines": [
                            ("Tom", "I should probably head off soon, but this has been really lovely."),
                            ("Lisa", "It really has. Let's not be strangers from now on, okay?"),
                            ("Tom", "Definitely not. Is your number still the same as before?"),
                            ("Lisa", "It is. Send me a quick message so I've got yours saved too."),
                            ("Tom", "Will do. Take care of yourself, and say hi to everyone for me."),
                            ("Lisa", "I will. See you on Saturday, and drive safely!"),
                        ],
                        "exercises": [
                            _fb(
                                "Keeping in touch", "Complete the phrase.", "Let's not be ___ from now on.", "strangers"
                            )
                        ],
                    }
                ],
            },
        ],
    },
    {
        "slug": "job-interviews-b1",
        "title": "Job Interviews (B1)",
        "level": "B1",
        "order": 14,
        "description": "Intermediate English for handling a job interview with confidence, from first impressions "
        "to smart questions. Listen, study the transcript, then pass each lesson with a Live Role-play.",
        "cover": {"c1": "#2A9D8F", "c2": "#176B5E", "icon": "briefcase"},
        "sections": [
            {
                "slug": "first-impressions",
                "title": "First Impressions",
                "description": "Arrive and greet the interviewer.",
                "lessons": [
                    {
                        "slug": "you-must-be-jake",
                        "title": "You Must Be Jake",
                        "description": "A warm welcome before the interview begins.",
                        "background": "company1-reception",
                        "characters": ["Maria", "Jake"],
                        "lines": [
                            ("Maria", "Hi, you must be Jake. Thanks for coming in. Did you find us okay?"),
                            ("Jake", "I did, thank you. The directions in your email were really clear."),
                            ("Maria", "Glad to hear it. Can I get you a glass of water before we start?"),
                            ("Jake", "I'm fine for now, thanks. I appreciate you taking the time to meet me."),
                            ("Maria", "Of course. Let's head into the meeting room and get comfortable."),
                            ("Jake", "Sounds good. I've genuinely been looking forward to this conversation."),
                        ],
                        "exercises": [
                            _fb(
                                "Arriving",
                                "Complete the question.",
                                "Thanks for coming in. Did you ___ us okay?",
                                "find",
                            )
                        ],
                    }
                ],
            },
            {
                "slug": "tell-me-about-yourself",
                "title": "Tell Me About Yourself",
                "description": "Introduce your background and motivation.",
                "lessons": [
                    {
                        "slug": "my-background",
                        "title": "A Bit About My Background",
                        "description": "Explaining your experience and why you applied.",
                        "background": "interview-room1",
                        "characters": ["Maria", "Jake"],
                        "lines": [
                            ("Maria", "So, to start, could you tell me a little about your background?"),
                            (
                                "Jake",
                                "Sure. I've spent the last four years as a backend developer, mostly working with Python.",
                            ),
                            ("Maria", "And what made you want to apply for this role in particular?"),
                            (
                                "Jake",
                                "I'm keen to work on larger systems, and your team has a great reputation for that.",
                            ),
                            (
                                "Maria",
                                "That's good to hear. We do get to tackle some genuinely interesting challenges.",
                            ),
                            ("Jake", "That's exactly the kind of environment I'm hoping to grow in."),
                        ],
                        "exercises": [
                            _mc(
                                "Interview answers",
                                "Pick the strong, relevant answer.",
                                "Why did you apply for this role?",
                                "I'm keen to work on larger systems, and your team has a great reputation.",
                                "I just need any job, really.",
                            )
                        ],
                    }
                ],
            },
            {
                "slug": "strengths-and-weaknesses",
                "title": "Strengths and Weaknesses",
                "description": "Talk honestly about yourself.",
                "lessons": [
                    {
                        "slug": "honest-reflection",
                        "title": "Honest Reflection",
                        "description": "Discussing a strength and an area to improve.",
                        "background": "interview-room1",
                        "characters": ["Maria", "Jake"],
                        "lines": [
                            ("Maria", "What would you say is your greatest strength as a developer?"),
                            ("Jake", "I'm good at breaking complex problems down into small, manageable steps."),
                            ("Maria", "And is there an area you're actively trying to improve?"),
                            (
                                "Jake",
                                "I used to struggle with delegating, but I've been learning to trust my team more.",
                            ),
                            ("Maria", "That's a thoughtful answer. Self-awareness matters a lot on this team."),
                            ("Jake", "I agree. I think honest reflection is really how you get better over time."),
                        ],
                        "exercises": [
                            _fb(
                                "Strengths",
                                "Complete the phrase.",
                                "I'm good at breaking complex problems into small, ___ steps.",
                                "manageable",
                            )
                        ],
                    }
                ],
            },
            {
                "slug": "your-questions",
                "title": "Do You Have Any Questions?",
                "description": "Ask the interviewer smart questions.",
                "lessons": [
                    {
                        "slug": "questions-for-you",
                        "title": "A Couple of Questions",
                        "description": "Turning the tables and asking good questions.",
                        "background": "interview-room1",
                        "characters": ["Maria", "Jake"],
                        "lines": [
                            ("Maria", "We're almost done. Do you have any questions for me?"),
                            ("Jake", "Yes, a couple. How would you describe the team's working culture?"),
                            ("Maria", "It's collaborative and fairly flexible. We value results over fixed hours."),
                            ("Jake", "That's reassuring. And what does success look like in the first six months?"),
                            (
                                "Maria",
                                "Great question. Mostly settling in, shipping steadily, and asking for help early.",
                            ),
                            ("Jake", "That honestly sounds like a place where I could really contribute."),
                        ],
                        "exercises": [
                            _mc(
                                "Candidate questions",
                                "Pick a smart question to ask.",
                                "What can you ask the interviewer?",
                                "What does success look like in the first six months?",
                                "When can I take my holidays?",
                            )
                        ],
                    }
                ],
            },
            {
                "slug": "wrapping-up",
                "title": "Wrapping Up",
                "description": "Close the interview well.",
                "lessons": [
                    {
                        "slug": "next-steps",
                        "title": "Next Steps",
                        "description": "Ending on a confident, polite note.",
                        "background": "interview-room1",
                        "characters": ["Maria", "Jake"],
                        "lines": [
                            ("Maria", "Thanks, Jake. We've really enjoyed talking with you today."),
                            ("Jake", "Thank you too. It's only made me more interested in the role."),
                            ("Maria", "We'll make a decision by the end of next week and be in touch."),
                            ("Jake", "Perfect. Please don't hesitate to reach out if you need anything else from me."),
                            ("Maria", "Will do. Have a safe trip home, and thanks again for coming in."),
                            ("Jake", "Take care. I really look forward to hearing from you."),
                        ],
                        "exercises": [
                            _fb(
                                "Closing",
                                "Complete the phrase.",
                                "Please don't ___ to reach out if you need anything.",
                                "hesitate",
                            )
                        ],
                    }
                ],
            },
        ],
    },
    {
        "slug": "everyday-errands-b1",
        "title": "Everyday Errands (B1)",
        "level": "B1",
        "order": 15,
        "description": "Intermediate English for getting things done around town: banks, parcels, pharmacies and "
        "appointments. Listen, study the transcript, then pass each lesson with a Live Role-play.",
        "cover": {"c1": "#43AA8B", "c2": "#2D6A4F", "icon": "map"},
        "sections": [
            {
                "slug": "at-the-bank",
                "title": "At the Bank",
                "description": "Open an account and ask about fees.",
                "lessons": [
                    {
                        "slug": "opening-an-account",
                        "title": "Opening an Account",
                        "description": "Setting up a new current account.",
                        "background": "company3-reception",
                        "characters": ["Linda", "Bob"],
                        "lines": [
                            ("Linda", "Hi, I'd like to open a current account today, if that's possible."),
                            ("Bob", "Of course. Do you have some photo ID and proof of address with you?"),
                            ("Linda", "I do. Here's my passport and a fairly recent utility bill."),
                            (
                                "Bob",
                                "Perfect. The account is free, though there's a small fee for international transfers.",
                            ),
                            ("Linda", "That's fine. I mostly need it for my salary and everyday spending."),
                            ("Bob", "In that case, this account should suit you nicely. Let me set it up for you."),
                        ],
                        "exercises": [
                            _fb("At the bank", "Complete the phrase.", "I'd like to ___ a current account.", "open")
                        ],
                    }
                ],
            },
            {
                "slug": "at-the-post-office",
                "title": "Sending a Parcel",
                "description": "Compare delivery options.",
                "lessons": [
                    {
                        "slug": "sending-a-parcel",
                        "title": "Standard or Express?",
                        "description": "Posting a parcel abroad.",
                        "background": "company3-reception",
                        "characters": ["Linda", "Bob"],
                        "lines": [
                            ("Linda", "Hi, I need to send this parcel abroad. What are my options?"),
                            (
                                "Bob",
                                "We have standard and express. Express arrives in three days but costs a bit more.",
                            ),
                            ("Linda", "How much slower is the standard service, roughly?"),
                            ("Bob", "Standard usually takes about a week, depending on customs at the other end."),
                            ("Linda", "I'm not in a rush, so I'll go with standard, please."),
                            ("Bob", "No problem. Could you fill in this customs form while I weigh it for you?"),
                        ],
                        "exercises": [
                            _mc(
                                "Post office",
                                "Pick the natural question.",
                                "You want to compare delivery speeds. What do you ask?",
                                "How much slower is the standard service?",
                                "Why is the parcel?",
                            )
                        ],
                    }
                ],
            },
            {
                "slug": "at-the-pharmacy",
                "title": "At the Pharmacy",
                "description": "Describe symptoms and get advice.",
                "lessons": [
                    {
                        "slug": "something-for-a-cold",
                        "title": "Something for a Cold",
                        "description": "Asking the pharmacist for help.",
                        "background": "company3-reception",
                        "characters": ["Linda", "Bob"],
                        "lines": [
                            ("Linda", "Excuse me, do you have anything for a sore throat and a cough?"),
                            ("Bob", "We do. Is it just the throat, or do you have a fever as well?"),
                            ("Linda", "No fever, just a scratchy throat and a slightly blocked nose."),
                            ("Bob", "In that case, I'd recommend these lozenges and a simple nasal spray."),
                            ("Linda", "Thanks. How often should I take the lozenges?"),
                            ("Bob", "One every three to four hours, but no more than six in a single day."),
                        ],
                        "exercises": [
                            _fb("Pharmacy", "Complete the question.", "Do you have anything for a ___ throat?", "sore")
                        ],
                    }
                ],
            },
            {
                "slug": "returning-an-item",
                "title": "Returning Something",
                "description": "Return a faulty product politely.",
                "lessons": [
                    {
                        "slug": "a-replacement-please",
                        "title": "A Replacement, Please",
                        "description": "Asking for a replacement for broken headphones.",
                        "background": "company3-reception",
                        "characters": ["Linda", "Bob"],
                        "lines": [
                            ("Linda", "Hi, I bought these headphones last week, but one side has stopped working."),
                            ("Bob", "I'm sorry about that. Do you still have the receipt and the box?"),
                            ("Linda", "I do. I'd actually prefer a replacement rather than a refund, if that's okay."),
                            ("Bob", "Absolutely. Let me just check we've got the same model in stock."),
                            ("Linda", "Thank you. They were a gift, so I'd like to keep things simple."),
                            ("Bob", "I completely understand. Good news, we've got one right here."),
                        ],
                        "exercises": [
                            _mc(
                                "Returns",
                                "Pick the polite request.",
                                "You want a new one instead of money back. What do you say?",
                                "I'd prefer a replacement rather than a refund.",
                                "Just give me whatever.",
                            )
                        ],
                    }
                ],
            },
            {
                "slug": "booking-an-appointment",
                "title": "Booking an Appointment",
                "description": "Arrange a convenient time.",
                "lessons": [
                    {
                        "slug": "a-dental-check-up",
                        "title": "A Dental Check-Up",
                        "description": "Booking a check-up around a work schedule.",
                        "background": "company3-reception",
                        "characters": ["Linda", "Bob"],
                        "lines": [
                            ("Linda", "Hi, I'd like to book a dental check-up sometime next week."),
                            ("Bob", "Sure. We have a slot on Tuesday morning or Thursday afternoon."),
                            ("Linda", "Thursday afternoon would be much easier around my work schedule."),
                            ("Bob", "Great. Shall I put you down for two o'clock with Dr. Adams?"),
                            ("Linda", "That's perfect. Will I get a reminder beforehand, by any chance?"),
                            ("Bob", "Yes, we'll send you a text the day before. You're all booked in."),
                        ],
                        "exercises": [
                            _fb(
                                "Appointments",
                                "Complete the phrase.",
                                "I'd like to ___ a dental check-up next week.",
                                "book",
                            )
                        ],
                    }
                ],
            },
        ],
    },
    {
        "slug": "negotiating-and-persuading-b2",
        "title": "Negotiating and Persuading (B2)",
        "level": "B2",
        "order": 16,
        "description": "Upper-intermediate English for negotiating deals and persuading with confidence: opening "
        "well, handling objections and closing fairly. Listen, study the transcript, then pass each "
        "lesson with a Live Role-play.",
        "cover": {"c1": "#3D348B", "c2": "#7678ED", "icon": "deck"},
        "sections": [
            {
                "slug": "setting-the-tone",
                "title": "Setting the Tone",
                "description": "Open a negotiation collaboratively.",
                "lessons": [
                    {
                        "slug": "what-matters-most",
                        "title": "What Matters Most",
                        "description": "Understanding the other side before talking numbers.",
                        "background": "company1-boardroom",
                        "characters": ["Brian", "Sarah"],
                        "lines": [
                            ("Brian", "Before we dive into numbers, I'd like to understand what matters most to you."),
                            (
                                "Sarah",
                                "I appreciate that. For us, a reliable timeline matters even more than the price.",
                            ),
                            (
                                "Brian",
                                "That's useful to know. We can certainly build some guarantees into the schedule.",
                            ),
                            (
                                "Sarah",
                                "If you can commit to firm milestones, we'd have a lot more flexibility on budget.",
                            ),
                            ("Brian", "Then let's frame this around delivery dates and work backwards from there."),
                            ("Sarah", "That sounds like a sensible starting point for both of us."),
                        ],
                        "exercises": [
                            _mc(
                                "Opening",
                                "Pick the collaborative opener.",
                                "How do you start a negotiation well?",
                                "I'd like to understand what matters most to you.",
                                "Take it or leave it.",
                            )
                        ],
                    }
                ],
            },
            {
                "slug": "making-your-case",
                "title": "Making Your Case",
                "description": "Argue your value clearly.",
                "lessons": [
                    {
                        "slug": "the-value-is-clear",
                        "title": "The Value Is Clear",
                        "description": "Justifying a higher figure with reasoning.",
                        "background": "company1-boardroom",
                        "characters": ["Brian", "Sarah"],
                        "lines": [
                            (
                                "Sarah",
                                "Our current proposal reflects the extra testing your team specifically requested.",
                            ),
                            (
                                "Brian",
                                "I understand, but the figure is still higher than we'd budgeted for this quarter.",
                            ),
                            (
                                "Sarah",
                                "I hear you. Keep in mind that thorough testing now will save costly fixes later.",
                            ),
                            (
                                "Brian",
                                "That's a fair argument. Could you walk me through the breakdown behind the estimate?",
                            ),
                            (
                                "Sarah",
                                "Of course. Once you see where the time actually goes, I think the value is clear.",
                            ),
                            ("Brian", "Send it over. If the detail holds up, I'm happy to take it to my director."),
                        ],
                        "exercises": [
                            _fb(
                                "Persuading",
                                "Complete the phrase.",
                                "Thorough testing now will ___ costly fixes later.",
                                "save",
                            )
                        ],
                    }
                ],
            },
            {
                "slug": "handling-objections",
                "title": "Handling Objections",
                "description": "Turn concerns into solutions.",
                "lessons": [
                    {
                        "slug": "a-review-clause",
                        "title": "A Review Clause",
                        "description": "Easing a client's worry with flexibility.",
                        "background": "company1-boardroom",
                        "characters": ["Brian", "Sarah"],
                        "lines": [
                            ("Brian", "My main concern is that we'd be locked in for a full twelve months."),
                            (
                                "Sarah",
                                "That's a reasonable worry. Would a six-month review clause put your mind at ease?",
                            ),
                            ("Brian", "It might. What exactly would that review allow us to change?"),
                            ("Sarah", "You could adjust the scope, or step away entirely if it isn't working out."),
                            ("Brian", "That kind of flexibility makes the commitment far easier to accept."),
                            ("Sarah", "Then let's write it in. I want this to feel like a partnership, not a trap."),
                        ],
                        "exercises": [
                            _mc(
                                "Objections",
                                "Pick the constructive response to a concern.",
                                "A client fears a long lock-in. What do you offer?",
                                "Would a six-month review clause put your mind at ease?",
                                "That's your problem, not mine.",
                            )
                        ],
                    }
                ],
            },
            {
                "slug": "finding-common-ground",
                "title": "Finding Common Ground",
                "description": "Close the final gap.",
                "lessons": [
                    {
                        "slug": "were-close",
                        "title": "We're Close",
                        "description": "Settling the last detail of the deal.",
                        "background": "company1-boardroom",
                        "characters": ["Brian", "Sarah"],
                        "lines": [
                            ("Sarah", "It feels like we're close. The only real gap left is the payment schedule."),
                            ("Brian", "Agreed. We'd prefer to pay in stages, tied to each milestone."),
                            ("Sarah", "I can work with that, as long as the final payment follows sign-off promptly."),
                            ("Brian", "That's fair. Say, within thirty days of approval?"),
                            ("Sarah", "Thirty days works. Honestly, this is shaping up better than I expected."),
                            ("Brian", "Same here. It helps that we've both been straight with each other throughout."),
                        ],
                        "exercises": [
                            _fb(
                                "Compromise",
                                "Complete the phrase.",
                                "The only real ___ left is the payment schedule.",
                                "gap",
                            )
                        ],
                    }
                ],
            },
            {
                "slug": "closing-the-deal",
                "title": "Closing the Deal",
                "description": "Confirm agreement and next steps.",
                "lessons": [
                    {
                        "slug": "an-agreement",
                        "title": "An Agreement We Can Stand Behind",
                        "description": "Finalising and summarising the deal.",
                        "background": "company1-boardroom",
                        "characters": ["Brian", "Sarah"],
                        "lines": [
                            ("Brian", "I think we have an agreement we can both genuinely stand behind."),
                            ("Sarah", "I think so too. Let me summarise the key points so nothing gets lost."),
                            ("Brian", "Please do. I'll have our legal team turn it into a draft this week."),
                            ("Sarah", "Wonderful. Once we've both reviewed it, we can sign and get started."),
                            ("Brian", "I'm genuinely looking forward to working together on this."),
                            ("Sarah", "Likewise. Thank you for being so reasonable throughout the whole process."),
                        ],
                        "exercises": [
                            _mc(
                                "Closing",
                                "Pick the natural closing line.",
                                "You've reached agreement. What do you say?",
                                "I think we have an agreement we can both stand behind.",
                                "Forget it, there's no deal.",
                            )
                        ],
                    }
                ],
            },
        ],
    },
    {
        "slug": "networking-and-relationships-b2",
        "title": "Networking and Building Relationships (B2)",
        "level": "B2",
        "order": 17,
        "description": "Upper-intermediate English for meeting people at events and turning contacts into real "
        "working relationships. Listen, study the transcript, then pass each lesson with a Live Role-play.",
        "cover": {"c1": "#06A77D", "c2": "#005377", "icon": "users"},
        "sections": [
            {
                "slug": "breaking-the-ice",
                "title": "Breaking the Ice",
                "description": "Start a conversation with a stranger.",
                "lessons": [
                    {
                        "slug": "enjoying-the-conference",
                        "title": "Enjoying the Conference?",
                        "description": "Striking up a chat at a tech conference.",
                        "background": "company2-roof",
                        "characters": ["Maria", "David"],
                        "lines": [
                            ("Maria", "This is a great turnout. Are you enjoying the conference so far?"),
                            ("David", "I am, actually. The talk on system design this morning really got me thinking."),
                            ("Maria", "Oh, I missed that one. What was the main takeaway, if you don't mind sharing?"),
                            (
                                "David",
                                "Essentially, that simplicity tends to scale better than cleverness in the long run.",
                            ),
                            ("Maria", "That resonates with me. I'm Maria, by the way. I lead a small platform team."),
                            ("David", "Lovely to meet you, Maria. I'm David. I work mostly on data infrastructure."),
                        ],
                        "exercises": [
                            _fb(
                                "Ice-breaker",
                                "Complete the question.",
                                "Are you ___ the conference so far?",
                                "enjoying",
                            )
                        ],
                    }
                ],
            },
            {
                "slug": "finding-common-interests",
                "title": "Finding Common Ground",
                "description": "Discover what you share.",
                "lessons": [
                    {
                        "slug": "same-battle",
                        "title": "The Same Battle",
                        "description": "Realising your teams face similar problems.",
                        "background": "company2-roof",
                        "characters": ["Maria", "David"],
                        "lines": [
                            (
                                "David",
                                "Platform and data teams usually end up solving fairly similar problems, don't they?",
                            ),
                            ("Maria", "Constantly. We're both fighting the same battle against complexity and scale."),
                            ("David", "Exactly. How is your team handling the move toward real-time pipelines?"),
                            (
                                "Maria",
                                "Carefully. We've learned not to rebuild everything just because it's fashionable.",
                            ),
                            (
                                "David",
                                "That's refreshing to hear. So many teams chase trends and end up regretting it.",
                            ),
                            ("Maria", "Right. I'd far rather adopt something slowly and actually understand it."),
                        ],
                        "exercises": [
                            _mc(
                                "Connecting",
                                "Pick the phrase that builds rapport.",
                                "You realise you share a challenge. What do you say?",
                                "We're both fighting the same battle against complexity.",
                                "I don't see how that's relevant.",
                            )
                        ],
                    }
                ],
            },
            {
                "slug": "exchanging-contacts",
                "title": "Staying in Touch",
                "description": "Exchange details naturally.",
                "lessons": [
                    {
                        "slug": "connect-on-linkedin",
                        "title": "Let's Connect",
                        "description": "Swapping contacts before parting.",
                        "background": "company2-roof",
                        "characters": ["Maria", "David"],
                        "lines": [
                            ("Maria", "I'd love to continue this conversation properly sometime soon."),
                            ("David", "So would I. Shall we connect on LinkedIn before we both forget?"),
                            ("Maria", "Good idea. I'll send you a request now while we're still standing here."),
                            ("David", "Perfect. And if you're ever curious about our data setup, just reach out."),
                            ("Maria", "I might well take you up on that. It's always useful to compare notes."),
                            (
                                "David",
                                "Absolutely. These conversations are honestly the real reason I come to these events.",
                            ),
                        ],
                        "exercises": [
                            _fb(
                                "Networking",
                                "Complete the suggestion.",
                                "Shall we ___ on LinkedIn before we forget?",
                                "connect",
                            )
                        ],
                    }
                ],
            },
            {
                "slug": "following-up",
                "title": "Following Up Afterwards",
                "description": "Reconnect after the event.",
                "lessons": [
                    {
                        "slug": "did-you-get-my-message",
                        "title": "Did You Get My Message?",
                        "description": "A warm, professional follow-up.",
                        "background": "company2-center",
                        "characters": ["Maria", "David"],
                        "lines": [
                            ("David", "Maria, good to catch you. Did you get my message after the conference?"),
                            ("Maria", "I did, thank you. I meant to reply sooner, but this week has been hectic."),
                            ("David", "No worries at all. I just wanted to share that article we'd discussed."),
                            ("Maria", "That's really thoughtful of you. I'll read it properly over the weekend."),
                            ("David", "No rush. I just thought it might be useful for the project you mentioned."),
                            ("Maria", "It probably will be. Let's grab a proper coffee once things calm down a bit."),
                        ],
                        "exercises": [
                            _mc(
                                "Follow-up",
                                "Pick the warm, professional reply.",
                                "Someone shared a useful article. What do you say?",
                                "That's really thoughtful of you. I'll read it over the weekend.",
                                "Stop sending me things.",
                            )
                        ],
                    }
                ],
            },
            {
                "slug": "turning-contacts-into-collaboration",
                "title": "From Contacts to Collaboration",
                "description": "Propose working together.",
                "lessons": [
                    {
                        "slug": "a-shared-experiment",
                        "title": "A Shared Experiment",
                        "description": "Turning a connection into a small project.",
                        "background": "company2-boardroom",
                        "characters": ["Maria", "David"],
                        "lines": [
                            ("Maria", "I've been thinking, our teams could actually help each other quite a bit."),
                            ("David", "Funny you should say that. I had the very same thought after our last chat."),
                            ("Maria", "Maybe we start small, with a shared experiment, and see how it goes."),
                            ("David", "I like that approach. Low risk, and we both learn something either way."),
                            ("Maria", "Exactly. I'll draft a rough proposal and we can shape it together."),
                            ("David", "Sounds great. It's rare to meet someone this easy to work with."),
                        ],
                        "exercises": [
                            _fb(
                                "Collaboration",
                                "Complete the phrase.",
                                "Maybe we start small, with a shared ___, and see how it goes.",
                                "experiment",
                            )
                        ],
                    }
                ],
            },
        ],
    },
]
