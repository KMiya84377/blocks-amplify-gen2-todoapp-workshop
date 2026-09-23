![alt text](<title.png>) 

# AWS Blocks × AWS Amplify Gen2 で作る、AIエージェント付きTODOアプリ ハンズオン

## 概要

このワークショップでは、AWS AmplifyGen2 と AWS Blocks を組み合わせて、ログイン機能・AIエージェント付きの Todo アプリケーションを構築します。

## 所要時間

- おまけ無し（1〜4章＋後処理）：約110分〜（1時間50分〜）
- おまけ含む（全7章）：約140分〜（2時間20分〜）

## 目的

- AWS Blocksの仕組み・考え方を理解する
- AWS Blocksの目玉機能である「ローカル環境だけで一通り開発が完結する」という恩恵を体感する

## 対象

AWS Blocksを触ったことがない方。基本的な開発経験があれば、AWS Blocks自体は初めてという方を対象にしています。

## 前提条件

- AWS アカウント（Admin 相当の権限）
- GitHub アカウント

## ワークショップの内容

| # | 内容 | 目安時間 |
|---|---|---|
| 1 | [初期設定](docs/1_初期設定.md) | 15分 |
| 2 | [TODOアプリ作成 by AWS Blocks](docs/2_TODOアプリ作成%20by%20AWS%20Blocks.md) | 45分 |
| 3 | [AIアシスタント追加 by AWS Blocks](docs/3_AIアシスタント追加%20by%20AWS%20Blocks.md) | 40分 |
| 4 | [ホスティング by AWS Amplify](docs/4_ホスティング%20by%20AWS%20Amplify.md) | 10分〜（Sandboxデプロイ部分は目安未記載） |
| 5 | [おまけ: Todo一覧のリアルタイム自動更新](docs/5_おまけ%20Todo一覧のリアルタイム自動更新.md) | 15分 |
| 6 | [おまけ: KnowledgeBaseでの検索](docs/6_おまけ%20KnowledgeBaseでの検索.md) | 15分 |
| 7 | [後処理](docs/7_後処理.md) | - |

## フォルダ構成

```
blocks-amplify-gen2-todoapp-workshop/
├── .devcontainer/
│   └── devcontainer.json
├── docs/
│   ├── 1_初期設定.md
│   ├── 2_TODOアプリ作成 by AWS Blocks.md
│   ├── 3_AIアシスタント追加 by AWS Blocks.md
│   ├── 4_ホスティング by AWS Amplify.md
│   ├── 5_おまけ Todo一覧のリアルタイム自動更新.md
│   ├── 6_おまけ KnowledgeBaseでの検索.md
│   └── 7_後処理.md
├── todo-app/
├── LICENSE
└── README.md
```

## システム構成

| 区分 | 使用する機能 | 役割 |
|---|---|---|
| AWS Amplify Gen2 | Hosting（CI/CD） | GitHubのmainブランチをトリガーに、フロントエンド・バックエンドを自動ビルド・デプロイ |
| AWS Blocks | `AuthCognito` | ログイン機能（Amazon Cognito） |
| AWS Blocks | `DistributedTable` | Todoデータの保存（Amazon DynamoDB） |
| AWS Blocks | `ApiNamespace` | Todo CRUD・チャット用APIの公開 |
| AWS Blocks | `Agent` | AIアシスタント機能（Amazon Bedrock） |
| AWS Blocks | `Realtime` | Todo一覧のリアルタイム自動更新（おまけ） |
| AWS Blocks | `KnowledgeBase` | 固有情報の検索機能（おまけ） |
