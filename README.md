# GaussianSplatting

動画から3D Gaussian Splattingのモデルを生成する手順をまとめたリポジトリです。
COLMAPによる学習データの切り出しはローカルPCで行い、GPUが必要な学習のみGoogle Colabで行います。

## 構成

| パス | 役割 |
|---|---|
| `model/process_video.sh` | 動画の圧縮、COLMAPによる学習データの切り出し、zip化をローカルで行う |
| `model/3DGS_Train.ipynb` | アップロードしたzipを展開し、Colabで学習と.ply書き出しを行う |
| `model/pyproject.toml` | ローカル環境の依存関係。uvで管理する |
| `3DGS_Tutorial.ipynb` | 全工程をColabで行う従来版 |

## ローカル環境のセットアップ

macOSでの手順です。

### 1. ffmpegとCOLMAPのインストール

```bash
cd ~
brew install ffmpeg colmap
```

### 2. Nerfstudioのインストール

`model/pyproject.toml` に依存関係を定義してあるので、uvで同期します。Python 3.11の仮想環境が `model/.venv` に作成されます。

```bash
cd model
uv sync
```

インストール後、コマンドが使えることを確認します。

```bash
uv run ns-process-data --help
```

## 使い方

### 1. ローカルで学習データを切り出す

```bash
# 学習データ用の動画は「input.mp4」というファイル名にして置く
cd model
uv run ./process_video.sh ./input.mp4 100
```

第2引数で切り出すフレーム数を指定できます。省略時は150フレームです。

```bash
uv run ./process_video.sh /path/to/input.mp4 200
```

完了すると `model/processed_data.zip` が作成されます。

### 2. Colabにアップロードする

`model/3DGS_Train.ipynb` をGoogle Colabで開き、左側のファイルパネルに `processed_data.zip` をドラッグ&ドロップします。

### 3. Colabで学習する

ランタイムをT4 GPUに変更してからセルを順に実行します。
学習完了後、3Dモデルの.plyファイルがダウンロードされます。
