/** Bind a camera request to one mounted video and release late streams too. */
export function startCamera(
  video: HTMLVideoElement,
  onReady: () => void,
  onError: () => void,
  requestStream = () => navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" } } }),
): () => void {
  let disposed = false;
  let stream: MediaStream | undefined;
  const stop = () => stream?.getTracks().forEach((track) => track.stop());
  void Promise.resolve().then(requestStream).then(async (activeStream) => {
    stream = activeStream;
    if (disposed) { stop(); return; }
    video.srcObject = stream;
    await video.play();
    if (!disposed) onReady();
  }).catch(() => { stop(); if (!disposed) onError(); });
  return () => { disposed = true; stop(); video.srcObject = null; };
}
