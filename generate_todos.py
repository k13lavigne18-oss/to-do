import csv
import random
import string
from datetime import datetime, timedelta

def generate_csv(filename, num_rows):
    headers = ['task', 'is_done', 'created_at', 'deadline', 'priority', 'details', 'link']
    
    tasks = ["APIの設計", "CORS設定の修正", "Docker環境の構築", "DBの正規化", "AWSへのデプロイ", "ドキュメント作成"]
    details_opts = ["急ぎで対応！", "後でチームメンバーに確認する", "参考資料を要チェック", ""]
    
    with open(filename, mode='w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        
        now = datetime.now()
        
        print("データ生成中...")
        for i in range(num_rows):
            # 1. 完全一意なタスク名（例: [00001] APIの設計 - X9A2）
            rand_str = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
            task = f"[{i+1:05d}] {random.choice(tasks)} - {rand_str}"
            
            is_done = "true" if random.random() < 0.2 else "false" # 20%の確率で完了
            
            # 2. 作成日時を「分単位」までランダムに散らす（ソートテスト用）
            random_minutes_ago = random.randint(0, 30 * 24 * 60) # 過去30日間(分)
            created_dt = now - timedelta(minutes=random_minutes_ago)
            created_at = created_dt.strftime('%Y/%m/%d %H:%M')
            
            # 3. 期限もランダム（80%の確率で設定）
            if random.random() < 0.8:
                deadline_dt = created_dt + timedelta(days=random.randint(1, 14), minutes=random.randint(0, 1440))
                deadline = deadline_dt.strftime('%Y-%m-%dT%H:%M')
            else:
                deadline = ""
                
            priority = random.randint(1, 5)
            
            # 4. 詳細とリンクにも一意なIDを含める
            details = f"Detail-ID:{i+1} {random.choice(details_opts)}"
            link = f"https://example.com/task/{i+1}"
            
            writer.writerow([task, is_done, created_at, deadline, priority, details, link])

if __name__ == "__main__":
    generate_csv("dummy_todos.csv", 50000)
    print("✨ 5万件の完全一意なダミーデータを出力しました: dummy_todos.csv")