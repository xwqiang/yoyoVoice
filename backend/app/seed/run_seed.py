from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models import Account, Course, CourseWord, User, Word
from app.models.roles import ROLE_ADMIN
from app.services.auth import hash_password

ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "123456"

ANIMALS = [
    ("cat", "猫", "/kæt/", "The cat is sleeping."),
    ("dog", "狗", "/dɒɡ/", "I have a dog."),
    ("bird", "鸟", "/bɜːrd/", "The bird can fly."),
    ("fish", "鱼", "/fɪʃ/", "The fish swims in water."),
    ("rabbit", "兔子", "/ˈræbɪt/", "The rabbit hops."),
    ("elephant", "大象", "/ˈelɪfənt/", "The elephant is big."),
    ("tiger", "老虎", "/ˈtaɪɡər/", "The tiger is strong."),
    ("monkey", "猴子", "/ˈmʌŋki/", "The monkey climbs trees."),
    ("bear", "熊", "/beər/", "The bear is brown."),
    ("lion", "狮子", "/ˈlaɪən/", "The lion is the king."),
]

COLORS = [
    ("red", "红色", "/red/", "The apple is red."),
    ("blue", "蓝色", "/bluː/", "The sky is blue."),
    ("green", "绿色", "/ɡriːn/", "The grass is green."),
    ("yellow", "黄色", "/ˈjeloʊ/", "The sun is yellow."),
    ("orange", "橙色", "/ˈɒrɪndʒ/", "The orange is orange."),
    ("purple", "紫色", "/ˈpɜːrpl/", "Grapes can be purple."),
    ("pink", "粉色", "/pɪŋk/", "The flower is pink."),
    ("black", "黑色", "/blæk/", "The night is black."),
    ("white", "白色", "/waɪt/", "Snow is white."),
    ("brown", "棕色", "/braʊn/", "The dog is brown."),
]


def _seed_course(db: Session, title: str, description: str, words_data: list, sort_base: int):
    existing = db.query(Course).filter(Course.title == title).first()
    if existing:
        return
    course = Course(title=title, description=description, level="beginner", sort_order=sort_base)
    db.add(course)
    db.flush()

    for i, (en, zh, ph, ex) in enumerate(words_data):
        word = db.query(Word).filter(Word.word_en == en).first()
        if not word:
            word = Word(word_en=en, meaning_zh=zh, phonetic=ph, example_sentence=ex)
            db.add(word)
            db.flush()
        db.add(CourseWord(course_id=course.id, word_id=word.id, unit="Unit 1", sort_order=i))


def _seed_admin(db: Session):
    if db.query(User).filter(User.username == ADMIN_USERNAME).first():
        return
    account = Account(name="系统管理")
    db.add(account)
    db.flush()
    db.add(
        User(
            account_id=account.id,
            username=ADMIN_USERNAME,
            hashed_password=hash_password(ADMIN_PASSWORD),
            display_name="管理员",
            role=ROLE_ADMIN,
        )
    )


def run_seed():
    db = SessionLocal()
    try:
        _seed_admin(db)
        _seed_course(db, "动物单词", "学习常见动物的英文名称", ANIMALS, 1)
        _seed_course(db, "颜色单词", "学习基本颜色的英文名称", COLORS, 2)
        db.commit()
    finally:
        db.close()
