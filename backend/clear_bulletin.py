import sys, json, os
sys.path.insert(0, 'core')
from app import BULLETIN_FILE

with open(BULLETIN_FILE, 'r', encoding='utf-8') as f:
    bulletin = json.load(f)

print(f"Total entries before: {len(bulletin)}")
for v in bulletin:
    print(f"  election_id={v.get('election_id')}")

election_id = int(input("Enter election ID to clear: "))
cleaned = [v for v in bulletin if v.get('election_id') != election_id]
print(f"Total entries after: {len(cleaned)}")

with open(BULLETIN_FILE, 'w', encoding='utf-8') as f:
    json.dump(cleaned, f)
print("Done.")