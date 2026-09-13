#!/usr/bin/env bash
# 動画から3D Gaussian Splattingの .ply をMac上だけで生成する
# 使い方: ./run_brush.sh input/input.mp4 [フレーム数] [学習ステップ数]
# 生成物はすべて output/brush/ に置く。丸ごと消して作り直してよい
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "使い方: $0 input/input.mp4 [フレーム数] [学習ステップ数]" >&2
  exit 1
fi

INPUT="$1"
NUM_FRAMES="${2:-100}"
TOTAL_STEPS="${3:-5000}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BRUSH="${SCRIPT_DIR}/bin/brush_app"
NAME="$(basename "${INPUT%.*}")"
OUTPUT_ROOT="${SCRIPT_DIR}/output/brush"
COMPRESSED="${OUTPUT_ROOT}/${NAME}_compressed.mp4"
IMAGES_DIR="${OUTPUT_ROOT}/images"
COLMAP_DIR="${OUTPUT_ROOT}/colmap"
SPARSE_DIR="${OUTPUT_ROOT}/sparse"

if [ ! -x "$BRUSH" ]; then
  echo "Brushが見つかりません。READMEの手順で ${BRUSH} に配置してください。" >&2
  exit 1
fi

START_TIME=$(date +%s)
step_time() {
  echo "  経過時間: $(( $(date +%s) - START_TIME ))秒"
}

rm -rf "$OUTPUT_ROOT"
mkdir -p "$IMAGES_DIR" "$COLMAP_DIR" "$SPARSE_DIR"

# 動画容量を削減してCOLMAPの処理時間を短縮する
echo "1. 動画を圧縮しています..."
ffmpeg -v error -y -i "$INPUT" -c:v libx264 -crf 28 -preset slow -c:a copy "$COMPRESSED"
step_time

# 等間隔にフレームを切り出す。元の解像度のままだと学習が重いため縦横を半分に縮小する
echo "2. 動画からフレームを切り出しています..."
TOTAL_FRAMES=$(ffprobe -v error -select_streams v:0 -count_packets \
  -show_entries stream=nb_read_packets -of csv=p=0 "$COMPRESSED")
SPACING=$(( TOTAL_FRAMES / NUM_FRAMES ))
if [ "$SPACING" -lt 1 ]; then
  SPACING=1
fi
echo "  総フレーム数 ${TOTAL_FRAMES}、${SPACING} フレームごとに切り出します"
ffmpeg -v error -y -i "$COMPRESSED" -fps_mode vfr \
  -vf "thumbnail=${SPACING},setpts=N/TB,scale=iw/2:ih/2" \
  "${IMAGES_DIR}/frame_%05d.png"
echo "  切り出した画像: $(ls "$IMAGES_DIR" | wc -l | tr -d ' ')枚"
step_time

# 特徴点の抽出、隣り合う画像同士の照合、カメラ位置と点群の推定を順に行う
echo "3. COLMAPでカメラ位置を推定しています..."
colmap feature_extractor \
  --database_path "${COLMAP_DIR}/database.db" \
  --image_path "$IMAGES_DIR" \
  --ImageReader.single_camera 1 \
  --ImageReader.camera_model OPENCV \
  --FeatureExtraction.use_gpu 0 \
  > "${COLMAP_DIR}/feature_extractor.log" 2>&1
colmap sequential_matcher \
  --database_path "${COLMAP_DIR}/database.db" \
  --FeatureMatching.use_gpu 0 \
  > "${COLMAP_DIR}/sequential_matcher.log" 2>&1
mkdir -p "${COLMAP_DIR}/models"
colmap mapper \
  --database_path "${COLMAP_DIR}/database.db" \
  --image_path "$IMAGES_DIR" \
  --output_path "${COLMAP_DIR}/models" \
  --Mapper.ba_global_function_tolerance=1e-6 \
  > "${COLMAP_DIR}/mapper.log" 2>&1

# mapperは複数のモデルを出力することがあり、Brushは sparse/0 を読む。
# 小さいモデルが先に来る場合があるため、登録画像数が最大のモデルを sparse/0 に置く
BEST_MODEL=""
BEST_COUNT=0
for model_dir in "${COLMAP_DIR}"/models/*/; do
  count=$(colmap model_analyzer --path "$model_dir" 2>&1 \
    | sed -n 's/.*Registered images: \([0-9]*\).*/\1/p')
  echo "  モデル $(basename "$model_dir"): 登録画像数 ${count:-0}"
  if [ "${count:-0}" -gt "$BEST_COUNT" ]; then
    BEST_COUNT=$count
    BEST_MODEL="$model_dir"
  fi
done
if [ -z "$BEST_MODEL" ]; then
  echo "COLMAPのモデルが生成されませんでした。${COLMAP_DIR}/mapper.log を確認してください。" >&2
  exit 1
fi
cp -R "$BEST_MODEL" "${SPARSE_DIR}/0"
echo "  採用: 登録画像数 ${BEST_COUNT} のモデル"
step_time

# Brushは images/ と sparse/0 を持つCOLMAP形式のフォルダを読み込む。
# 既定の成長設定では点が増えずぼやけた結果になるため、しきい値を下げて成長させる。
# 点数が増えるほど1ステップが遅くなるため上限を設け、5000ステップごとに途中結果を書き出す
echo "4. Brushで学習しています... (${TOTAL_STEPS}ステップ)"
"$BRUSH" "$OUTPUT_ROOT" \
  --total-steps "$TOTAL_STEPS" \
  --growth-grad-threshold 0.00001 \
  --growth-select-fraction 0.5 \
  --max-splats 500000 \
  --export-every 5000 \
  --export-path "$OUTPUT_ROOT"
step_time

# 書き出しファイル名の桁数はBrushが決めるため、最後に書き出されたものを最終結果とする
PLY=$(ls -t "${OUTPUT_ROOT}"/export_*.ply | head -n 1)
echo "完了: ${PLY}"
