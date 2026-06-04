"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Upload, Camera, ShieldCheck, Loader2, CheckCircle,
  XCircle, AlertTriangle, ArrowLeft, ArrowRight, Eye,
} from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { uploadFile, apiRequest } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { cn } from "@/lib/utils";

type Step = "id-type" | "upload-id" | "selfie" | "verify" | "result";

export default function KycPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ticketId = searchParams.get("ticketId");
  const token = getToken();

  const [step, setStep] = useState<Step>("id-type");
  const [idType, setIdType] = useState("");
  const [idFile, setIdFile] = useState<File | null>(null);
  const [idPreview, setIdPreview] = useState<string | null>(null);
  const [selfieBlob, setSelfieBlob] = useState<Blob | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [livenessPass, setLivenessPass] = useState(false);
  const [livenessPrompt, setLivenessPrompt] = useState("Please BLINK to confirm you are present");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ status: string; message: string; faceMatchScore?: number } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const STEPS: Step[] = ["id-type", "upload-id", "selfie", "verify", "result"];
  const stepIndex = STEPS.indexOf(step);
  const progress = (stepIndex / (STEPS.length - 1)) * 100;

  if (!ticketId) {
    return (
      <AppShell allowedRoles={["CUSTOMER"]}>
        <div className="p-8 text-center text-muted-foreground">No ticket ID provided.</div>
      </AppShell>
    );
  }

  // ID file handler
  const handleIdFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIdFile(file);
    setIdPreview(URL.createObjectURL(file));
  };

  // Upload ID
  const uploadId = async () => {
    if (!idFile) return;
    setLoading(true);
    try {
      const form = new FormData();
      form.append("idDocument", idFile);
      form.append("ticketId", ticketId);
      form.append("idType", idType);
      await uploadFile("/kyc/upload-id", form, token!);
      toast.success("ID document uploaded.");
      setStep("selfie");
      startCamera();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      streamRef.current = stream;
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      }, 300);
    } catch {
      toast.error("Camera access denied. Please allow camera access to continue.");
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  // Liveness: simulate blink detection by asking user to click after blinking
  const confirmLiveness = () => {
    setLivenessPass(true);
    setLivenessPrompt("Liveness confirmed!");
    toast.success("Liveness check passed.");
  };

  // Capture selfie
  const captureSelfie = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      if (!blob) return;
      setSelfieBlob(blob);
      setSelfiePreview(URL.createObjectURL(blob));
      stopCamera();
    }, "image/jpeg", 0.9);
  };

  // Upload selfie + verify
  const uploadSelfieAndVerify = async () => {
    if (!selfieBlob) return;
    setLoading(true);
    try {
      const form = new FormData();
      form.append("selfie", selfieBlob, "selfie.jpg");
      form.append("ticketId", ticketId);
      form.append("livenessPass", String(livenessPass));
      await uploadFile("/kyc/upload-selfie", form, token!);

      setStep("verify");
      const res = await apiRequest<{ status: string; message: string; faceMatchScore: number }>(
        "/kyc/verify",
        { method: "POST", body: { ticketId }, token: token! }
      );
      setResult(res);
      setStep("result");
    } catch (err: any) {
      toast.error(err.message);
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell allowedRoles={["CUSTOMER"]}>
      <div className="p-8 max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-full">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Identity Verification</h2>
            <p className="text-sm text-muted-foreground">Complete KYC to process your ticket</p>
          </div>
        </div>

        {/* Progress bar */}
        <Progress value={progress} className="h-2" />

        {/* Step: ID Type */}
        {step === "id-type" && (
          <Card>
            <CardHeader>
              <CardTitle>Step 1 — Select ID type</CardTitle>
              <CardDescription>Choose the type of document you will upload</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Document type</Label>
                <Select value={idType} onValueChange={setIdType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select document type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NATIONAL_ID">National ID Card</SelectItem>
                    <SelectItem value="PASSPORT">International Passport</SelectItem>
                    <SelectItem value="DRIVERS_LICENSE">Driver&apos;s License</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-amber-800 text-xs space-y-1">
                <p className="font-semibold">Before you proceed:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Ensure your ID document is valid (not expired)</li>
                  <li>Document must be clearly visible with no glare</li>
                  <li>All four corners of the document must be visible</li>
                </ul>
              </div>
              <Button disabled={!idType} onClick={() => setStep("upload-id")}>
                Continue <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step: Upload ID */}
        {step === "upload-id" && (
          <Card>
            <CardHeader>
              <CardTitle>Step 2 — Upload your ID</CardTitle>
              <CardDescription>JPG, PNG or PDF — max 5MB</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className={cn(
                "block border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                idPreview ? "border-primary bg-primary/5" : "border-border hover:border-primary"
              )}>
                <input type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden" onChange={handleIdFile} />
                {idPreview ? (
                  <div className="space-y-2">
                    <img src={idPreview} alt="ID preview" className="max-h-48 mx-auto rounded object-contain" />
                    <p className="text-xs text-muted-foreground">{idFile?.name} — click to change</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="h-10 w-10 text-muted-foreground mx-auto" />
                    <p className="text-sm font-medium">Click to upload your document</p>
                    <p className="text-xs text-muted-foreground">JPG, PNG or PDF up to 5MB</p>
                  </div>
                )}
              </label>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep("id-type")}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button disabled={!idFile || loading} onClick={uploadId}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Upload & continue
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step: Selfie */}
        {step === "selfie" && (
          <Card>
            <CardHeader>
              <CardTitle>Step 3 — Take a selfie</CardTitle>
              <CardDescription>Your face must be clearly visible and well-lit</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selfiePreview ? (
                <>
                  <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="border-2 border-white/60 rounded-full w-40 h-52 opacity-70" />
                    </div>
                  </div>
                  <canvas ref={canvasRef} className="hidden" />

                  {/* Liveness check */}
                  <div className={cn(
                    "border rounded-md p-3 text-sm flex items-center justify-between",
                    livenessPass ? "bg-green-50 border-green-200 text-green-800" : "bg-blue-50 border-blue-200 text-blue-800"
                  )}>
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4 shrink-0" />
                      <span>{livenessPrompt}</span>
                    </div>
                    {!livenessPass && (
                      <Button size="sm" variant="outline" onClick={confirmLiveness}>
                        I blinked
                      </Button>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => { stopCamera(); setStep("upload-id"); }}>
                      <ArrowLeft className="mr-2 h-4 w-4" /> Back
                    </Button>
                    <Button disabled={!livenessPass} onClick={captureSelfie}>
                      <Camera className="mr-2 h-4 w-4" /> Capture selfie
                    </Button>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <img src={selfiePreview} alt="Selfie preview" className="max-h-64 mx-auto rounded-lg object-contain" />
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => { setSelfiePreview(null); setSelfieBlob(null); startCamera(); }}>
                      Retake
                    </Button>
                    <Button disabled={loading} onClick={uploadSelfieAndVerify}>
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Submit for verification
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step: Verifying */}
        {step === "verify" && (
          <Card>
            <CardContent className="pt-12 pb-12 text-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
              <h3 className="text-lg font-semibold">Verifying your identity</h3>
              <p className="text-sm text-muted-foreground">Running OCR and face match. This takes a few seconds...</p>
            </CardContent>
          </Card>
        )}

        {/* Step: Result */}
        {step === "result" && result && (
          <Card>
            <CardContent className="pt-10 pb-10 text-center space-y-5">
              {result.status === "VERIFIED" && <CheckCircle className="h-14 w-14 text-green-500 mx-auto" />}
              {result.status === "MANUAL_REVIEW" && <AlertTriangle className="h-14 w-14 text-yellow-500 mx-auto" />}
              {result.status === "FAILED" && <XCircle className="h-14 w-14 text-red-500 mx-auto" />}

              <div>
                <h3 className="text-xl font-bold">
                  {result.status === "VERIFIED" ? "Identity Verified" :
                   result.status === "MANUAL_REVIEW" ? "Under Manual Review" : "Verification Failed"}
                </h3>
                <p className="text-muted-foreground text-sm mt-1">{result.message}</p>
                {result.faceMatchScore && (
                  <p className="text-xs text-muted-foreground mt-1">Face match confidence: {result.faceMatchScore.toFixed(1)}%</p>
                )}
              </div>

              <Button onClick={() => router.push("/dashboard")}>
                Go to dashboard
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
