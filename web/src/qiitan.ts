import * as THREE from "three";
import { SplatMesh } from "@sparkjsdev/spark";
import type { PackedSplats } from "@sparkjsdev/spark";
import type { RapierPhysicsObject } from "three/addons/physics/RapierPhysics.js";
import { type CapsuleSize, type Vec3, capsuleFor, fitScale } from "./falling";

// Qiitan 1 体の見た目と寸法。SplatMesh を複製するときの共通情報
export type QiitanShape = {
  // 読み込み済みのスプラットデータ。複製時に共有して再取得を避ける
  packedSplats: PackedSplats;
  // 最長辺を目標サイズに合わせる一様スケール
  scale: number;
  // スケール後の外接ボックス中心。カプセル中心と揃えるために打ち消す
  center: THREE.Vector3;
  // スケール後の外接ボックスの大きさ
  size: THREE.Vector3;
  capsule: CapsuleSize;
};

// URL から Qiitan を読み込み、複製に必要な寸法を求める
export async function loadQiitanShape(url: string, targetSize: number): Promise<QiitanShape> {
  // 寸法の計測用。LOD を有効にすると外接ボックスを取得できないため、ここでは無効のまま読み込む
  const probe = new SplatMesh({ url });
  await probe.initialized;
  if (!probe.packedSplats) {
    throw new Error("スプラットデータを読み込めませんでした");
  }

  const box = probe.getBoundingBox();
  const rawSize = box.getSize(new THREE.Vector3());
  const scale = fitScale(rawSize, targetSize);
  const size = rawSize.multiplyScalar(scale);
  const center = box.getCenter(new THREE.Vector3()).multiplyScalar(scale);

  return { packedSplats: probe.packedSplats, scale, center, size, capsule: capsuleFor(size) };
}

// 表示用の SplatMesh と、物理演算用の見えないカプセルを 1 組にまとめる
export class Qiitan {
  // 表示用。毎フレームカプセルの姿勢をコピーする
  readonly group = new THREE.Group();
  // 物理演算用。RapierPhysics に登録し、画面には出さない
  readonly body: THREE.Mesh;

  constructor(
    shape: QiitanShape,
    physics: RapierPhysicsObject,
    mass: number,
    restitution: number,
    angularDamping: number,
  ) {
    // LOD を有効にして、画面上で小さいときはスプラットを間引けるようにする
    const splats = new SplatMesh({ packedSplats: shape.packedSplats, lod: true });
    splats.scale.setScalar(shape.scale);
    splats.position.copy(shape.center).negate();
    this.group.add(splats);

    const geometry = new THREE.CapsuleGeometry(shape.capsule.radius, shape.capsule.length, 4, 8);
    this.body = new THREE.Mesh(geometry);
    this.body.visible = false;
    // 画面外で待機させ、物理演算の対象になってから落下位置へ移す
    this.body.position.set(0, -100, 0);
    physics.addMesh(this.body, mass, restitution);
    // タブが非表示になると物理演算のステップ幅が大きくなり、床をすり抜けることがある。
    // 連続衝突検出を有効にして、どんなステップ幅でも床で止まるようにする
    this.body.userData.physics.body.enableCcd(true);
    // 回転を早く減衰させ、着地後に転がり続けて向きが変わらないようにする
    this.body.userData.physics.body.setAngularDamping(angularDamping);
  }

  // 指定位置から、姿勢と速度を与えて落下を始める
  drop(
    physics: RapierPhysicsObject,
    position: Vec3,
    rotation: Vec3,
    velocity: Vec3,
    angularVelocity: Vec3,
  ): void {
    physics.setMeshPosition(this.body, position);
    // RapierPhysics は姿勢と角速度の設定を公開していないため、登録済みの剛体を直接扱う
    const rigidBody = this.body.userData.physics.body;
    const quaternion = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(rotation.x, rotation.y, rotation.z),
    );
    rigidBody.setRotation(quaternion, true);
    rigidBody.setAngvel(angularVelocity, true);
    physics.setMeshVelocity(this.body, velocity);
    this.sync();
  }

  // 一瞬だけ力を加えて転がす
  nudge(physics: RapierPhysicsObject, impulse: Vec3): void {
    physics.applyImpulse(this.body, impulse);
  }

  // カプセルの姿勢を表示用グループへコピーする
  sync(): void {
    this.group.position.copy(this.body.position);
    this.group.quaternion.copy(this.body.quaternion);
  }
}
