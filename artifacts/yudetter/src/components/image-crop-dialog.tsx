import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { Slider } from "./ui/slider";
import { ZoomIn, ZoomOut } from "lucide-react";

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Canvas でピクセル切り抜き */
async function getCroppedImg(
  imageSrc: string,
  pixelCrop: CropArea
): Promise<Blob> {
  const image = await createImageBitmap(
    await fetch(imageSrc).then((r) => r.blob())
  );
  const canvas = document.createElement("canvas");
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Canvas toBlob failed"));
    }, "image/jpeg", 0.92);
  });
}

interface ImageCropDialogProps {
  open: boolean;
  onClose: () => void;
  /** object-URL または data-URL */
  imageSrc: string;
  /** "avatar" = 1:1 円形, "header" = 3:1 横長 */
  aspect: "avatar" | "header";
  /** クロップ確定後に呼ばれる（Blob を渡す） */
  onConfirm: (blob: Blob) => void;
}

export default function ImageCropDialog({
  open,
  onClose,
  imageSrc,
  aspect,
  onConfirm,
}: ImageCropDialogProps) {
  const aspectRatio = aspect === "avatar" ? 1 : 3;
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(null);

  const onCropComplete = useCallback((_: unknown, cap: CropArea) => {
    setCroppedAreaPixels(cap);
  }, []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    const blob = await getCroppedImg(imageSrc, croppedAreaPixels);
    onConfirm(blob);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[520px] p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-4 pb-2">
          <DialogTitle>
            {aspect === "avatar" ? "アイコン画像を調整" : "ヘッダー画像を調整"}
          </DialogTitle>
        </DialogHeader>

        {/* クロッパー領域 */}
        <div
          className="relative bg-black"
          style={{ height: aspect === "avatar" ? 320 : 240 }}
        >
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspectRatio}
            cropShape={aspect === "avatar" ? "round" : "rect"}
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        {/* ズームスライダー */}
        <div className="flex items-center gap-3 px-6 py-3">
          <ZoomOut className="w-4 h-4 text-muted-foreground shrink-0" />
          <Slider
            min={1}
            max={3}
            step={0.05}
            value={[zoom]}
            onValueChange={([v]) => setZoom(v)}
            className="flex-1"
          />
          <ZoomIn className="w-4 h-4 text-muted-foreground shrink-0" />
        </div>

        <DialogFooter className="px-5 pb-4 gap-2">
          <Button variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          <Button onClick={handleConfirm}>
            確定
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
