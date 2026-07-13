"""
Management command to seed realistic bus stops for all PMPL routes.

Strategy:
  - Every route gets at least: source stop + destination stop
  - Well-known Pune stops get real GPS coordinates
  - Intermediate stops are injected based on major landmarks on each corridor
  - travel_minutes, distance_from_prev, arrival_offset are calculated proportionally
"""

import math
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.routes.models import Route, Stop


# ─── Known Pune stop coordinates (lat, lng) ───────────────────────────────────
# Reference: Real GPS coordinates of major PMPL stops in Pune

STOP_COORDS = {
    # ── Major Terminals / Hubs ─────────────────────────────────────────────
    "Pune Station":             (18.5274, 73.8744),
    "Pune Railway Station":     (18.5274, 73.8744),
    "Swargate":                 (18.5018, 73.8636),
    "Shivajinagar":             (18.5308, 73.8474),
    "Ma Na Pa":                 (18.5196, 73.8553),
    "Deccan Gymkhana":          (18.5167, 73.8410),
    "Marketyard":               (18.4939, 73.8479),
    "Mandai":                   (18.5165, 73.8555),
    "Hadapsar Gadital":         (18.5013, 73.9349),
    "Kothrud Depot":            (18.5073, 73.8101),
    "Balewadi Depot":           (18.5653, 73.7779),
    "Bhakti Shakti":            (18.6203, 73.7867),
    "Nehrunagar Depot":         (18.6207, 73.7822),
    "Nigdi":                    (18.6508, 73.7706),
    "Upper Depot":              (18.5310, 73.8605),
    "Katraj":                   (18.4518, 73.8587),
    "Hinjawadi Maan Phase 3":   (18.5916, 73.7368),
    "Hinjawadi":                (18.5983, 73.7362),
    "Bhosari":                  (18.6303, 73.8469),
    "Bhosari Terminal":         (18.6303, 73.8469),
    "Alandi":                   (18.6749, 73.9007),
    "Vishrantwadi":             (18.5844, 73.9018),
    "Lohgaon":                  (18.6014, 73.9186),
    "Pimpri":                   (18.6278, 73.7998),
    "Chinchwadgaon":            (18.6312, 73.8034),

    # ── Swargate / South Pune Corridor ────────────────────────────────────
    "Natraj Stand":             (18.4802, 73.8388),
    "Shaniwarwada":             (18.5196, 73.8553),
    "Shaniwarwada Stand":       (18.5196, 73.8553),
    "Sarasbaug":                (18.4954, 73.8547),
    "Padmawati":                (18.4882, 73.8484),
    "Na Ta Wadi":               (18.4761, 73.8636),
    "Khandoba Mandir":          (18.4528, 73.8631),
    "Narhegaon":                (18.4675, 73.8502),
    "Sahkarnagar":              (18.4855, 73.8604),
    "Bibvewadi":                (18.4877, 73.8580),
    "Marketyard Gate":          (18.4940, 73.8479),
    "Pune Station Bus Stop":    (18.5274, 73.8744),
    "Sadesatranali":            (18.4861, 73.9336),
    "Bhansali Complex":         (18.4901, 73.8510),

    # ── Kothrud / West Pune Corridor ─────────────────────────────────────
    "Kothrud Stand":            (18.5050, 73.8143),
    "Warje Malwadi":            (18.4936, 73.8100),
    "Warje":                    (18.4936, 73.8100),
    "Dhayari Maruti Mandir":    (18.4671, 73.8013),
    "Nanded":                   (18.4462, 73.8236),
    "Suncity":                  (18.4834, 73.8201),
    "Vadgaon Bk":               (18.4697, 73.8145),
    "Gujarat Colony":           (18.5010, 73.8205),
    "Gujrat Colony":            (18.5010, 73.8205),
    "Galinde Path":             (18.4833, 73.8353),
    "Kondhwa Gate":             (18.4624, 73.9018),
    "Kondhwa Bk":               (18.4598, 73.9053),
    "Kondhwa Hospital":         (18.4632, 73.9024),
    "Kondhwagate":              (18.4623, 73.9018),
    "Sutardara":                (18.5249, 73.8795),
    "Sutarwadi":                (18.5360, 73.7948),
    "Pashan":                   (18.5348, 73.8026),
    "Medi Point":               (18.5140, 73.8234),
    "Sukhsagarnagar":           (18.5147, 73.8142),
    "Upper Depot":              (18.5310, 73.8605),
    "Kumbare Park":             (18.5021, 73.8242),
    "Kumbre Park":              (18.5021, 73.8242),
    "Gujrat Colony":            (18.5010, 73.8205),
    "DSK Vishwa":               (18.4660, 73.8043),
    "Gujarwadi":                (18.4560, 73.8580),
    "Jambhulwadi":              (18.4468, 73.8607),
    "Chintamani Dnyanpith":     (18.4806, 73.8625),

    # ── Hinjawadi / IT Corridor ───────────────────────────────────────────
    "Mhalungegaon":             (18.5603, 73.7713),
    "Balewadi":                 (18.5623, 73.7785),
    "Balewadi Mhalunge Phata":  (18.5603, 73.7713),
    "Wakad":                    (18.5983, 73.7748),
    "Pimplenilakh":             (18.6149, 73.7869),
    "Khadki Bazar":             (18.5638, 73.8465),
    "Kamalpark":                (18.5881, 73.7958),
    "Pimplegurav":              (18.6080, 73.7886),
    "Sangvi":                   (18.5821, 73.8085),
    "Vasantdada Putala Sangvi": (18.5841, 73.8079),

    # ── Hadapsar / East Pune Corridor ────────────────────────────────────
    "Kesnand Phata":            (18.5282, 73.9826),
    "Kharadi Gaon":             (18.5511, 73.9423),
    "Vadgaonsheri":             (18.5543, 73.9200),
    "Vimannagar":               (18.5648, 73.9195),
    "Anand Park":               (18.5524, 73.9102),
    "Wadebolhai":               (18.5366, 74.0287),
    "Vadegaon":                 (18.5315, 74.0497),
    "Lohgaon":                  (18.6014, 73.9186),
    "Dhanori":                  (18.5904, 73.9018),
    "Azadnagar":                (18.5270, 73.9394),
    "Salunke Vihar":            (18.5193, 73.9361),
    "Keshavnagar":              (18.5098, 73.9386),
    "Mundhwagaon":              (18.5027, 73.9315),
    "Manjari Kh":               (18.4961, 73.9516),
    "Manjari Bk":               (18.4934, 73.9552),
    "Fursungi":                 (18.4836, 73.9348),
    "Undrigaon":                (18.4815, 73.9293),
    "Vadkigaon":                (18.4758, 73.9392),
    "Holkarwadi":               (18.4698, 73.9293),
    "Vadachiwadi":              (18.4831, 73.9575),
    "Sadesatranali":            (18.4861, 73.9336),
    "Devachi Uruli":            (18.4774, 73.9419),
    "JSPM College":             (18.4888, 73.9531),
    "Mohammadwadigaon":         (18.4868, 73.9530),
    "Mahammad Wadi":            (18.4840, 73.9512),
    "Krushnanagar Mohammadwadi":(18.4883, 73.9543),

    # ── Pimpri-Chinchwad / North Pune ────────────────────────────────────
    "Bhekrainagar":             (18.4559, 73.9634),
    "Shewalwadi":               (18.4497, 73.9648),
    "Dapodi Mantri Niketan":    (18.6035, 73.8296),
    "Bopkhel":                  (18.6375, 73.8507),
    "Indoorance System":        (18.7014, 73.8543),
    "Aditya Garden City":       (18.6417, 73.7948),
    "Popularnagar":             (18.6370, 73.8071),
    "Cipla Center":             (18.6378, 73.8073),
    "Mukai Chowk":              (18.6019, 73.7749),
    "Sainagar Mamurdi":         (18.5944, 73.7668),
    "Ishanyanagari":            (18.6387, 73.8007),
    "Nehrunagar":               (18.6207, 73.7822),

    # ── Far East / Rural ──────────────────────────────────────────────────
    "Uruli Kanchan":            (18.4626, 74.0701),
    "Uruli Railway Station":    (18.4598, 74.0682),
    "Mhatobachi Alandi":        (18.4624, 74.0620),
    "Talegaon Dhamdhere":       (18.5620, 74.2090),
    "Koregaon Bhima":           (18.5706, 74.2140),
    "Pabal Phata":              (18.5769, 74.2516),
    "Nhavi Sandas":             (18.5823, 74.1547),
    "Kendurgaon":               (18.3827, 73.7628),
    "Theur":                    (18.4641, 74.0171),
    "Saswad":                   (18.3475, 74.0415),
    "Nasrapur":                 (18.3120, 73.9893),
    "Khanapur":                 (18.4163, 73.7538),
    "Osade Phata":              (18.3884, 73.7830),
    "Ghotawade Phata":          (18.5469, 73.7296),
    "Ghotawadegaon":            (18.5469, 73.7296),
    "Marnewadi":                (18.2876, 73.8768),
    "Agalambegaon":             (18.2618, 73.9010),
    "Paudgaon":                 (18.4346, 73.6688),
    "Kondhanpur":               (18.3278, 73.9162),
    "Khed Shivapur":            (18.3098, 73.9406),
    "Loni Kalbhor":             (18.4769, 74.0528),
    "Talegaon":                 (18.7336, 73.6690),
    "Dehu Road":                (18.6932, 73.7617),
    "Pirangut":                 (18.5128, 73.6924),
    "Chikhali":                 (18.6620, 73.8007),
    "Mugawade":                 (18.4297, 73.6802),
    "Sangrun":                  (18.4199, 73.6944),
    "Kondhur Phata":            (18.4180, 73.7168),
    "Sheregaon":                (18.4254, 73.7302),
    "Shasakiya Vishramgruha Paudgaon": (18.4346, 73.6688),

    # ── Misc ──────────────────────────────────────────────────────────────
    "Vidyanagar":               (18.5247, 73.8398),
    "Gokhalenagar":             (18.5379, 73.8270),
    "Pandavnagar":              (18.5452, 73.8351),
    "Niljyoti":                 (18.5352, 73.8175),
    "Shanipar":                 (18.5372, 73.8238),
    "Siddharthnagar":           (18.5302, 73.9157),
    "Sangamwadi":               (18.5590, 73.8986),
    "VIT College":              (18.5571, 73.9019),
    "Trinity College":          (18.5702, 73.8971),
    "Pune Vidhyapeeth":         (18.5561, 73.8490),
    "Bharati Vidyapeeth":       (18.4968, 73.8219),
    "Lake Town Society":        (18.5641, 73.8018),
    "Tadiwala Road":            (18.5218, 73.8797),
    "Kalyaninagar":             (18.5456, 73.9049),
    "SRP Camp":                 (18.4700, 73.9023),
    "Police Ground":            (18.5213, 73.8742),
    "Venutai Chavan College":   (18.4628, 73.8136),
    "MIT College":              (18.4839, 73.8090),
    "D2 Circle":                (18.4858, 73.8006),
    "NDA Gol Market":           (18.4860, 73.8010),
    "NDA Golmarket":            (18.4860, 73.8010),
    "Sai Sayajinagar":          (18.4897, 73.8268),
    "Mohakarwadi":              (18.4762, 73.7802),
    "HMR Company":              (18.5434, 73.7914),
    "HEMRL Company":            (18.5612, 73.8461),
    "Ammunition Factory":       (18.5580, 73.8468),
    "Saritanagari":             (18.4852, 73.8002),
    "Raykarmala":               (18.4834, 73.8067),
    "Shree Control":            (18.4812, 73.8043),
    "Appa Balawant Chowk":      (18.5201, 73.8589),
    "Kalewadi Phata":           (18.6260, 73.7877),
    "Vishalnagar":              (18.6237, 73.7902),
    "Dadachi Padal":            (18.6050, 73.9231),
    "Munjabavasti":             (18.5919, 73.8962),
    "Khulewadi":                (18.5889, 73.8959),
    "Sanaswadi Nandoshi":       (18.5617, 73.9887),
    "Ghulenagar":               (18.5047, 73.7952),
    "Susgaon":                  (18.5408, 73.7718),
    "Dhanorigaon":              (18.5904, 73.9018),
    "Koregaon Park":            (18.5364, 73.8935),
    "Sainathnagar":             (18.5556, 73.9237),
    "Shubham Society Nagar Road":(18.5543, 73.9200),
    "Yewalewadi":               (18.4727, 73.8722),
    "Sinhgad":                  (18.3625, 73.7563),
    "Sinhgad Paytha":           (18.3821, 73.7676),
    "VJR1":                     (18.4671, 73.8013),
    "Mukai Chowk":              (18.6019, 73.7749),
    "D.Y. Patil Vidhypith Lohgaon": (18.6014, 73.9186),
    "Sarasbaug":                (18.4954, 73.8547),
    "Ghulenager":               (18.5047, 73.7952),
    "Sutarwadi Pashan":         (18.5348, 73.8026),
    "Holkarwadi":               (18.4698, 73.9293),
    "Khed Shivapur":            (18.3098, 73.9406),
    "Bhakti Shakti Depot":      (18.6203, 73.7867),
    "VJR2A Kothrud Stand":      (18.5050, 73.8143),
}

# ─── Intermediate stop corridors ─────────────────────────────────────────────
# For popular corridors, define a realistic set of intermediate stops.
# Key = frozenset of (source_keyword, destination_keyword), Value = list of stop names in order

CORRIDOR_STOPS = {
    # Hinjawadi ↔ Ma Na Pa / Pune Station
    ("hinjawadi", "ma na pa"):      ["Wakad", "Balewadi", "Sangvi", "Shivajinagar", "Deccan Gymkhana"],
    ("hinjawadi", "pune station"):  ["Wakad", "Balewadi", "Sangvi", "Shivajinagar", "Deccan Gymkhana", "Shaniwarwada"],
    ("hinjawadi", "swargate"):      ["Wakad", "Balewadi", "Kothrud Stand", "Deccan Gymkhana"],
    ("hinjawadi", "katraj"):        ["Wakad", "Balewadi", "Kothrud Stand", "Deccan Gymkhana", "Swargate"],
    ("hinjawadi", "bhosari"):       ["Wakad", "Pimplegurav", "Nehrunagar", "Pimpri"],
    ("hinjawadi", "hadapsar"):      ["Wakad", "Shivajinagar", "Pune Station", "Kharadi Gaon"],

    # Pune Station / Ma Na Pa ↔ various
    ("pune station", "katraj"):     ["Deccan Gymkhana", "Swargate", "Sarasbaug", "Padmawati"],
    ("pune station", "kothrud"):    ["Deccan Gymkhana", "Mandai", "Kothrud Stand"],
    ("pune station", "hadapsar"):   ["Kharadi Gaon", "Vimannagar", "Vadgaonsheri"],
    ("pune station", "kondhwa"):    ["Shaniwarwada", "Swargate", "Sarasbaug"],
    ("pune station", "alandi"):     ["Shivajinagar", "Sangamwadi", "Vishrantwadi"],
    ("pune station", "lohgaon"):    ["Shivajinagar", "Vishrantwadi", "Dhanori"],
    ("pune station", "bhekrainagar"): ["Shaniwarwada", "Hadapsar Gadital"],
    ("pune station", "vimannagar"): ["Shivajinagar", "Sangamwadi", "Kharadi Gaon"],
    ("pune station", "varanasi"):   ["Shivajinagar", "Deccan Gymkhana"],
    ("pune station", "wadebolhai"): ["Shivajinagar", "Vishrantwadi", "Kesnand Phata"],
    ("pune station", "vadegaon"):   ["Shivajinagar", "Vishrantwadi", "Kesnand Phata"],
    ("pune station", "nhavi sandas"):["Shivajinagar", "Vishrantwadi", "Kesnand Phata"],
    ("pune station", "ghotawade"):  ["Deccan Gymkhana", "Kothrud Stand", "Sutarwadi"],
    ("pune station", "upper depot"):["Shaniwarwada", "Deccan Gymkhana"],
    ("pune station", "swargate"):   ["Shaniwarwada", "Deccan Gymkhana"],

    # Ma Na Pa ↔ various
    ("ma na pa", "bhosari"):        ["Shivajinagar", "Sangamwadi", "Vishrantwadi", "Pimpri"],
    ("ma na pa", "alandi"):         ["Shivajinagar", "Vishrantwadi"],
    ("ma na pa", "lohgaon"):        ["Shivajinagar", "Vishrantwadi", "Dhanori"],
    ("ma na pa", "bhekrainagar"):   ["Hadapsar Gadital", "Fursungi"],
    ("ma na pa", "pimplegurav"):    ["Shivajinagar", "Sangvi", "Pimplenilakh"],
    ("ma na pa", "chinchwadgaon"):  ["Shivajinagar", "Pimpri", "Nehrunagar Depot"],
    ("ma na pa", "warje malwadi"):  ["Swargate", "Deccan Gymkhana", "Kothrud Stand"],
    ("ma na pa", "keshavnagar"):    ["Hadapsar Gadital", "Kharadi Gaon"],
    ("ma na pa", "talegaon"):       ["Vishrantwadi", "Kesnand Phata"],

    # Swargate ↔ various
    ("swargate", "katraj"):         ["Sarasbaug", "Padmawati"],
    ("swargate", "kesnand"):        ["Hadapsar Gadital", "Vimannagar"],
    ("swargate", "bhekrainagar"):   ["Hadapsar Gadital", "Fursungi"],
    ("swargate", "hadapsar"):       ["Sarasbaug", "Padmawati"],
    ("swargate", "vimannagar"):     ["Shaniwarwada", "Pune Station", "Kharadi Gaon"],
    ("swargate", "saswad"):         ["Hadapsar Gadital", "Fursungi", "Bhekrainagar"],
    ("swargate", "nasrapur"):       ["Hadapsar Gadital", "Bhekrainagar", "Shewalwadi"],
    ("swargate", "khanapur"):       ["Marketyard", "Deccan Gymkhana"],
    ("swargate", "fursungi"):       ["Sarasbaug", "Hadapsar Gadital"],
    ("swargate", "dhayari"):        ["Marketyard", "Padmawati"],
    ("swargate", "nanded"):         ["Marketyard", "Padmawati", "Suncity"],
    ("swargate", "mohammadwadi"):   ["Hadapsar Gadital", "Bhekrainagar"],
    ("swargate", "mahammad wadi"):  ["Hadapsar Gadital", "Bhekrainagar"],
    ("swargate", "vadachiwadi"):    ["Hadapsar Gadital"],
    ("swargate", "chintamani"):     ["Marketyard", "Padmawati"],
    ("swargate", "uruli kanchan"):  ["Hadapsar Gadital", "Fursungi", "Bhekrainagar"],

    # Deccan / Kothrud ↔ various
    ("deccan gymkhana", "pimplegurav"): ["Shivajinagar", "Sangvi"],
    ("deccan gymkhana", "dsk vishwa"):  ["Kothrud Stand", "Warje Malwadi"],
    ("deccan gymkhana", "katraj"):      ["Mandai", "Swargate", "Sarasbaug"],
    ("deccan gymkhana", "sheregaon"):   ["Kothrud Stand", "Warje Malwadi", "Mugawade"],
    ("deccan gymkhana", "mugawade"):    ["Kothrud Stand", "Warje Malwadi"],
    ("deccan gymkhana", "paudgaon"):    ["Kothrud Stand", "Warje Malwadi", "Mugawade"],
    ("deccan gymkhana", "bhosari"):     ["Shivajinagar", "Pimplegurav", "Nehrunagar"],
    ("deccan gymkhana", "vidyanagar"):  ["Shivajinagar"],
    ("kothrud depot", "katraj"):        ["Warje Malwadi", "Swargate", "Sarasbaug"],
    ("kothrud depot", "kondhwa"):       ["Warje Malwadi", "Swargate"],
    ("kothrud depot", "hadapsar"):      ["Swargate", "Sarasbaug", "Marketyard"],
    ("kothrud depot", "lohgaon"):       ["Shivajinagar", "Vishrantwadi", "Dhanori"],
    ("kothrud depot", "pimplegurav"):   ["Warje Malwadi", "Shivajinagar", "Sangvi"],
    ("kothrud depot", "mandai"):        ["Deccan Gymkhana"],
    ("kothrud depot", "bhosari"):       ["Shivajinagar", "Pimplegurav", "Nehrunagar"],

    # Hadapsar ↔ various
    ("hadapsar gadital", "katraj"):     ["Marketyard", "Swargate", "Sarasbaug"],
    ("hadapsar gadital", "warje"):      ["Marketyard", "Swargate", "Kothrud Stand"],
    ("hadapsar gadital", "kothrud"):    ["Swargate", "Marketyard"],
    ("hadapsar gadital", "kesnand"):    ["Kharadi Gaon", "Vimannagar"],
    ("hadapsar gadital", "uruli"):      ["Fursungi", "Bhekrainagar"],
    ("hadapsar gadital", "saswad"):     ["Fursungi", "Bhekrainagar"],

    # Marketyard ↔ various
    ("marketyard", "upper depot"):      ["Swargate", "Shaniwarwada"],
    ("marketyard", "shivajinagar"):     ["Swargate", "Shaniwarwada"],
    ("marketyard", "pimplegurav"):      ["Swargate", "Shivajinagar", "Sangvi"],
    ("marketyard", "sangamwadi"):       ["Shaniwarwada", "Pune Station"],
    ("marketyard", "paudgaon"):         ["Swargate", "Kothrud Stand", "Warje Malwadi", "Mugawade"],
    ("marketyard", "agalambegaon"):     ["Swargate", "Sarasbaug", "Hadapsar Gadital"],
    ("marketyard", "ghotawadegaon"):    ["Swargate", "Kothrud Stand", "Warje Malwadi"],
    ("marketyard", "marnewadi"):        ["Swargate", "Hadapsar Gadital", "Saswad"],
    ("marketyard", "warje"):            ["Swargate", "Na Ta Wadi"],
    ("marketyard", "kondhwagate"):      ["Swargate", "Na Ta Wadi"],

    # Bhakti Shakti ↔ various
    ("bhakti shakti", "katraj"):        ["Nehrunagar Depot", "Pimpri", "Swargate"],
    ("bhakti shakti", "hadapsar"):      ["Nehrunagar Depot", "Shivajinagar", "Pune Station", "Kharadi Gaon"],
    ("bhakti shakti", "bhekrainagar"):  ["Nehrunagar Depot", "Pimpri", "Swargate", "Hadapsar Gadital"],
    ("bhakti shakti", "shewalwadi"):    ["Nehrunagar Depot", "Pimpri", "Hadapsar Gadital", "Fursungi"],
    ("bhakti shakti", "ma na pa"):      ["Nehrunagar Depot", "Pimpri", "Shivajinagar"],
    ("bhakti shakti", "pune station"):  ["Nehrunagar Depot", "Pimpri", "Shivajinagar", "Deccan Gymkhana"],
    ("bhakti shakti", "upper depot"):   ["Nehrunagar Depot", "Pimpri", "Shivajinagar"],
    ("bhakti shakti", "swargate"):      ["Nehrunagar Depot", "Pimpri", "Shivajinagar", "Deccan Gymkhana"],
    ("bhakti shakti", "salunke vihar"): ["Nehrunagar Depot", "Pimpri", "Hadapsar Gadital"],

    # Bhosari ↔ various
    ("bhosari", "bhekrainagar"):        ["Pimpri", "Hadapsar Gadital", "Fursungi"],
    ("bhosari", "deccan"):              ["Pimpri", "Shivajinagar"],
    ("bhosari", "shivajinagar"):        ["Pimpri"],
    ("bhosari", "pune station"):        ["Pimpri", "Shivajinagar"],
    ("bhosari", "katraj"):              ["Pimpri", "Swargate", "Sarasbaug"],
    ("bhosari", "kothrud depot"):       ["Pimpri", "Shivajinagar", "Swargate"],
    ("bhosari", "hinjawadi"):           ["Pimplegurav", "Wakad"],

    # Alandi / Vishrantwadi ↔ various
    ("alandi", "bhekrainagar"):         ["Vishrantwadi", "Pune Station", "Hadapsar Gadital", "Fursungi"],
    ("alandi", "ma na pa"):             ["Vishrantwadi", "Pune Station"],
    ("alandi", "pune station"):         ["Vishrantwadi"],
    ("alandi", "katraj"):               ["Vishrantwadi", "Pune Station", "Swargate", "Sarasbaug"],
    ("alandi", "kothrud"):              ["Vishrantwadi", "Pune Station", "Deccan Gymkhana"],
    ("alandi", "shivajinagar"):         ["Vishrantwadi"],
    ("vishrantwadi", "pimplenilakh"):   ["Khadki Bazar"],
    ("vishrantwadi", "pune station"):   ["Dhanori", "Lohgaon"],

    # Pimplegurav / Nigdi area ↔ various
    ("pimplegurav", "swargate"):        ["Sangvi", "Shivajinagar", "Deccan Gymkhana"],
    ("pimplegurav", "katraj"):          ["Sangvi", "Shivajinagar", "Swargate"],
    ("pimplegurav", "hadapsar"):        ["Shivajinagar", "Pune Station", "Kharadi Gaon"],
    ("pimplegurav", "shewalwadi"):      ["Shivajinagar", "Swargate", "Hadapsar Gadital", "Fursungi"],
    ("pimplegurav", "marketyard"):      ["Shivajinagar", "Deccan Gymkhana", "Swargate"],
    ("pimplegurav", "kothrud depot"):   ["Sangvi", "Shivajinagar", "Deccan Gymkhana"],
    ("pimplegurav", "gujrat colony"):   ["Sangvi", "Shivajinagar"],
    ("pimplegurav", "ma na pa"):        ["Sangvi", "Shivajinagar"],
    ("pimplegurav", "deccan"):          ["Sangvi", "Shivajinagar"],

    # Chinchwadgaon ↔ various
    ("chinchwadgaon", "ma na pa"):      ["Pimpri", "Shivajinagar"],
    ("chinchwadgaon", "bhekrainagar"):  ["Pimpri", "Hadapsar Gadital", "Fursungi"],
    ("chinchwadgaon", "katraj"):        ["Pimpri", "Shivajinagar", "Swargate"],
    ("chinchwadgaon", "pune station"):  ["Pimpri", "Shivajinagar"],
    ("chinchwadgaon", "shivajinagar"):  ["Pimpri"],

    # Far rural / long distance
    ("uruli kanchan", "sarasbaug"):     ["Hadapsar Gadital", "Marketyard"],
    ("uruli kanchan", "hadapsar"):      ["Fursungi", "Bhekrainagar"],
    ("theur", "hadapsar gadital"):      ["Fursungi"],
    ("saswad", "swargate"):            ["Sadesatranali", "Hadapsar Gadital", "Marketyard"],
    ("saswad", "hadapsar gadital"):     ["Fursungi", "Bhekrainagar"],
    ("nhavi sandas", "pune station"):   ["Kesnand Phata", "Vishrantwadi", "Shivajinagar"],
    ("nhavi sandas", "kesnand phata"):  [],
    ("kendurgaon", "pune station"):     ["Nasrapur", "Khanpur", "Swargate"],
    ("ghotawade phata", "pune station"):["Sutarwadi", "Pashan", "Deccan Gymkhana"],
    ("talegaon dhamdhere", "ma na pa"): ["Koregaon Bhima", "Vishrantwadi", "Shivajinagar"],
    ("agalambegaon", "marketyard"):     ["Swargate", "Sarasbaug"],
    ("marnewadi", "marketyard"):        ["Saswad", "Hadapsar Gadital", "Swargate"],
}


def get_coords(stop_name):
    """Return (lat, lng) for a stop name, searching partial matches."""
    # Exact match first
    if stop_name in STOP_COORDS:
        return STOP_COORDS[stop_name]
    # Case-insensitive partial match
    sl = stop_name.lower()
    for key, val in STOP_COORDS.items():
        if key.lower() in sl or sl in key.lower():
            return val
    return (None, None)


def lerp(a, b, t):
    """Linear interpolation between a and b at parameter t (0..1)."""
    return a + (b - a) * t


def interpolate_coords(src_lat, src_lng, dst_lat, dst_lng, t):
    """Linearly interpolate coordinates."""
    if src_lat is None or dst_lat is None:
        return (None, None)
    return (lerp(src_lat, dst_lat, t), lerp(src_lng, dst_lng, t))


def find_intermediate_stops(source, destination):
    """Look up known corridor stops between source and destination."""
    sl = source.lower().strip()
    dl = destination.lower().strip()

    # Try direct corridor lookup with partial key matching
    for (sk, dk), stops in CORRIDOR_STOPS.items():
        if sk in sl and dk in dl:
            return stops
        if dk in sl and sk in dl:  # reverse direction
            return list(reversed(stops))
    return []


def haversine_km(lat1, lon1, lat2, lon2):
    """Approximate distance between two GPS points in km."""
    if None in (lat1, lon1, lat2, lon2):
        return 0
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def build_stops_for_route(route):
    """
    Build a list of stop dicts for the given route.
    Returns list of dicts with keys: name, order, lat, lng,
    travel_minutes, distance_from_prev, arrival_offset
    """
    source = route.source.strip()
    destination = route.destination.strip()
    total_dist = float(route.distance)

    # Get intermediates from corridor map
    intermediates = find_intermediate_stops(source, destination)

    # Build full stop name list
    all_stop_names = [source] + intermediates + [destination]

    # Remove duplicates while preserving order
    seen = set()
    unique_stops = []
    for s in all_stop_names:
        key = s.lower().strip()
        if key not in seen:
            seen.add(key)
            unique_stops.append(s)
    all_stop_names = unique_stops

    n = len(all_stop_names)

    # Get source and destination coords
    src_lat, src_lng = get_coords(source)
    dst_lat, dst_lng = get_coords(destination)

    stops = []
    cumulative_dist = 0.0
    cumulative_time = 0

    for i, stop_name in enumerate(all_stop_names):
        t = i / max(n - 1, 1)  # 0.0 to 1.0

        # GPS coordinates
        lat, lng = get_coords(stop_name)
        if lat is None:
            lat, lng = interpolate_coords(src_lat, src_lng, dst_lat, dst_lng, t)

        # Distance from previous stop
        if i == 0:
            dist_from_prev = 0.0
        else:
            # Proportional share of total distance
            seg_dist = total_dist / (n - 1)
            if lat is not None:
                prev = stops[-1]
                if prev['lat'] is not None:
                    measured = haversine_km(prev['lat'], prev['lng'], lat, lng)
                    seg_dist = measured if measured > 0.1 else seg_dist
            dist_from_prev = round(seg_dist, 2)
            cumulative_dist += dist_from_prev

        # Travel time (assumes avg 18 km/h in city traffic)
        if i == 0:
            travel_mins = 0
        else:
            travel_mins = max(2, int(dist_from_prev / 18 * 60))

        cumulative_time += travel_mins

        stops.append({
            'name': stop_name,
            'order': i + 1,
            'lat': round(lat, 7) if lat is not None else None,
            'lng': round(lng, 7) if lng is not None else None,
            'distance_from_prev': dist_from_prev,
            'travel_minutes': travel_mins,
            'arrival_offset': cumulative_time,
        })

    return stops


class Command(BaseCommand):
    help = 'Seed realistic bus stops for all PMPL routes in the database'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing stops before seeding (default: skip routes that already have stops)',
        )
        parser.add_argument(
            '--route',
            type=str,
            help='Seed stops for a specific route number only (e.g. --route 101-D)',
        )

    def handle(self, *args, **options):
        clear_first = options.get('clear')
        specific_route = options.get('route')

        if clear_first:
            count = Stop.objects.all().delete()[0]
            self.stdout.write(self.style.WARNING(f'Cleared {count} existing stops.'))

        if specific_route:
            routes = Route.objects.filter(route_number=specific_route)
        else:
            routes = Route.objects.all().order_by('route_number')

        total_routes = routes.count()
        self.stdout.write(f'Seeding stops for {total_routes} routes...')

        routes_done = 0
        routes_skipped = 0
        total_stops_created = 0
        errors = []

        with transaction.atomic():
            for route in routes:
                # Skip if already has stops (unless --clear was used)
                if not clear_first and route.stops.exists():
                    routes_skipped += 1
                    continue

                try:
                    stop_defs = build_stops_for_route(route)

                    # Delete existing stops for this route if re-seeding
                    route.stops.all().delete()

                    # Bulk create stops
                    stop_objs = [
                        Stop(
                            route=route,
                            name=s['name'],
                            order=s['order'],
                            latitude=s['lat'],
                            longitude=s['lng'],
                            distance_from_prev=s['distance_from_prev'],
                            travel_minutes=s['travel_minutes'],
                            arrival_offset=s['arrival_offset'],
                        )
                        for s in stop_defs
                    ]
                    Stop.objects.bulk_create(stop_objs)
                    total_stops_created += len(stop_objs)
                    routes_done += 1

                    if routes_done % 100 == 0:
                        self.stdout.write(f'  ... {routes_done}/{total_routes} routes done')

                except Exception as e:
                    errors.append(f'Route {route.route_number}: {e}')

        self.stdout.write(self.style.SUCCESS(
            f'\n[SUCCESS] Stop Seeding Complete!'
            f'\n   Routes processed : {routes_done}'
            f'\n   Routes skipped   : {routes_skipped} (already had stops)'
            f'\n   Total stops created: {total_stops_created}'
            f'\n   Avg stops/route  : {round(total_stops_created / max(routes_done, 1), 1)}'
        ))

        if errors:
            self.stdout.write(self.style.ERROR(f'\nErrors ({len(errors)}):'))
            for err in errors[:10]:
                self.stdout.write(self.style.ERROR(f'  {err}'))
