#!/usr/bin/env bash
# 動画を圧縮し、COLMAPで学習データを切り出し、Colabへ渡すzipを作成する
# 使い方: ./process_video.sh input/input.mp4 [フレーム数]
# 生成物はすべて output/ に置く。output/ は git で除外しており、丸ごと消して作り直してよい
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "使い方: $0 input/input.mp4 [フレーム数]" >&2
  exit 1
fi

INPUT="$1"
NUM_FRAMES="${2:-150}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
NAME="$(basename "${INPUT%.*}")"
OUTPUT_ROOT="${SCRIPT_DIR}/output"
COMPRESSED="${OUTPUT_ROOT}/${NAME}_compressed.mp4"
FRAMES_DIR="${OUTPUT_ROOT}/frames"
OUTPUT_DIR="${OUTPUT_ROOT}/processed_data"
ZIP_PATH="${OUTPUT_ROOT}/processed_data.zip"
mkdir -p "$OUTPUT_ROOT"

# 動画容量を削減してCOLMAPの処理時間とアップロード時間を短縮する
echo "1. 動画を圧縮しています..."
ffmpeg -y -i "$INPUT" -c:v libx264 -crf 28 -preset slow -c:a copy "$COMPRESSED"

# ns-process-data video はffmpeg 9で廃止された -vsync を使うため、
# フレーム切り出しはここで行い、nerfstudioには画像フォルダを渡す
echo "2. 動画からフレームを切り出しています..."
rm -rf "$FRAMES_DIR"
mkdir -p "$FRAMES_DIR"
TOTAL_FRAMES=$(ffprobe -v error -select_streams v:0 -count_packets \
  -show_entries stream=nb_read_packets -of csv=p=0 "$COMPRESSED")
SPACING=$(( TOTAL_FRAMES / NUM_FRAMES ))
if [ "$SPACING" -lt 1 ]; then
  SPACING=1
fi
echo "総フレーム数 ${TOTAL_FRAMES}、${SPACING} フレームごとに切り出します"
ffmpeg -y -i "$COMPRESSED" -fps_mode vfr \
  -vf "thumbnail=${SPACING},setpts=N/TB" \
  "${FRAMES_DIR}/frame_%05d.png"

# 前回実行時のデータが残っていると失敗するため削除する
echo "3. COLMAPで学習データを作成しています..."
rm -rf "$OUTPUT_DIR"
ns-process-data images \
  --data "$FRAMES_DIR" \
  --output-dir "$OUTPUT_DIR" \
  --no-gpu

# Colabへ1ファイルで置けるようにまとめる
echo "4. zipにまとめています..."
rm -f "$ZIP_PATH"
(cd "$OUTPUT_ROOT" && zip -qr "$(basename "$ZIP_PATH")" "$(basename "$OUTPUT_DIR")")

echo "完了: ${ZIP_PATH} をGoogle Driveにアップロードしてください。"
