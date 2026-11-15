export interface SampleShotConfig {
  id: string;
  name: string;
  description: string;
  releaseAngle: number;
  initialSpeed: number;
  startX: number;
  startY: number;
  hoopX: number;
  hoopY: number;
  outcome: 'make' | 'miss';
  tag: string;
}

export const SAMPLE_SHOTS: SampleShotConfig[] = [
  {
    id: 'shot_corner_3',
    name: 'Curry-Style High Arc 3PT',
    description: 'High 53° rainbow release from deep, peaking high with soft entry for a clean swish.',
    releaseAngle: 53,
    initialSpeed: 17.5,
    startX: 110,
    startY: 380,
    hoopX: 620,
    hoopY: 180,
    outcome: 'make',
    tag: '53° Rainbow Arc',
  },
  {
    id: 'shot_midrange_pullup',
    name: 'Elbow Pull-Up Jumper',
    description: 'Classic 48° textbook jumper with sharp elevation and crisp backspin touch.',
    releaseAngle: 48,
    initialSpeed: 16.0,
    startX: 160,
    startY: 360,
    hoopX: 620,
    hoopY: 180,
    outcome: 'make',
    tag: '48° Textbook Arc',
  },
  {
    id: 'shot_flat_floater_miss',
    name: 'Flat Fastbreak Runner',
    description: 'Rushed 37° low trajectory lacking arc elevation, resulting in a front-rim clank.',
    releaseAngle: 37,
    initialSpeed: 15.2,
    startX: 200,
    startY: 350,
    hoopX: 620,
    hoopY: 180,
    outcome: 'miss',
    tag: '37° Flat Clank',
  },
];

/**
 * Generates an animated video clip Blob of the shot in real-time using Canvas + MediaRecorder
 */
export async function generateShotVideoBlob(config: SampleShotConfig): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 720;
  canvas.height = 480;
  const ctx = canvas.getContext('2d')!;

  // Try MediaRecorder
  const stream = canvas.captureStream(30);
  let mediaRecorder: MediaRecorder | null = null;
  const chunks: Blob[] = [];

  const mimeTypes = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  let chosenMime = 'video/webm';
  for (const m of mimeTypes) {
    if (MediaRecorder.isTypeSupported(m)) {
      chosenMime = m;
      break;
    }
  }

  try {
    mediaRecorder = new MediaRecorder(stream, { mimeType: chosenMime });
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
  } catch (e) {
    console.warn('MediaRecorder not available, fallback will be used', e);
  }

  return new Promise((resolve) => {
    if (!mediaRecorder) {
      // Fallback empty blob
      return resolve(new Blob([], { type: 'video/webm' }));
    }

    mediaRecorder.onstop = () => {
      resolve(new Blob(chunks, { type: chosenMime }));
    };

    mediaRecorder.start();

    // Physics parameters
    const totalFrames = 90; // 3 seconds at 30 fps
    let frame = 0;

    const g = 0.38; // gravity in canvas px/frame^2
    const rad = (config.releaseAngle * Math.PI) / 180;
    let vx = config.initialSpeed * Math.cos(rad) * 0.9;
    let vy = -config.initialSpeed * Math.sin(rad) * 0.9;

    let ballX = config.startX;
    let ballY = config.startY;
    const hoopX = config.hoopX;
    const hoopY = config.hoopY;

    let bounced = false;

    const interval = setInterval(() => {
      frame++;

      // Update ball physics
      if (frame > 15 && frame < 75) {
        ballX += vx;
        ballY += vy;
        vy += g;

        // Make or miss collision at hoop
        if (!bounced && Math.hypot(ballX - hoopX, ballY - hoopY) < 25) {
          if (config.outcome === 'miss') {
            // Bounce back off front rim
            vx = -vx * 0.4;
            vy = -Math.abs(vy) * 0.6;
            bounced = true;
          }
        }
      }

      // Draw Court Scene
      // Dark modern gym background
      const grad = ctx.createLinearGradient(0, 0, 0, 480);
      grad.addColorStop(0, '#090d16');
      grad.addColorStop(0.65, '#131b2e');
      grad.addColorStop(0.65, '#2e1c11');
      grad.addColorStop(1, '#1c1008');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 720, 480);

      // Hardwood court lines
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 312);
      ctx.lineTo(720, 312); // baseline line
      ctx.stroke();

      // Free throw lane lines
      ctx.strokeStyle = 'rgba(217, 119, 6, 0.4)';
      ctx.beginPath();
      ctx.ellipse(360, 400, 200, 80, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Backboard & Hoop
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.fillRect(hoopX + 16, hoopY - 55, 8, 90);
      ctx.strokeRect(hoopX + 16, hoopY - 55, 8, 90);

      // Backboard inner target square
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.strokeRect(hoopX + 16, hoopY - 30, 4, 35);

      // Rim (Orange cylinder)
      ctx.fillStyle = '#f97316';
      ctx.fillRect(hoopX - 22, hoopY - 2, 38, 5);

      // Net (subtle mesh lines)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(hoopX - 20, hoopY + 3);
      ctx.lineTo(hoopX - 10, hoopY + 35);
      ctx.lineTo(hoopX + 6, hoopY + 35);
      ctx.lineTo(hoopX + 14, hoopY + 3);
      ctx.stroke();

      // Shooter silhouette
      ctx.fillStyle = '#1e293b';
      // Torso & head
      ctx.beginPath();
      ctx.arc(config.startX - 15, config.startY - 40, 12, 0, Math.PI * 2); // head
      ctx.fill();
      ctx.fillRect(config.startX - 23, config.startY - 25, 16, 50); // torso
      // Legs
      ctx.fillRect(config.startX - 23, config.startY + 25, 7, 45);
      ctx.fillRect(config.startX - 13, config.startY + 25, 7, 45);
      // Shooting arm
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#334155';
      ctx.beginPath();
      ctx.moveTo(config.startX - 12, config.startY - 20);
      ctx.lineTo(config.startX, config.startY - 5);
      ctx.lineTo(ballX, ballY);
      ctx.stroke();

      // Basketball (Authentic Orange #ea580c with ribs/leather lines)
      const ballRadius = 12;
      ctx.save();
      ctx.translate(ballX, ballY);
      ctx.rotate((frame * 0.15) % (Math.PI * 2)); // backspin rotation!

      // Ball body
      const ballGrad = ctx.createRadialGradient(-3, -3, 2, 0, 0, ballRadius);
      ballGrad.addColorStop(0, '#f97316');
      ballGrad.addColorStop(0.7, '#ea580c');
      ballGrad.addColorStop(1, '#9a3412');
      ctx.fillStyle = ballGrad;
      ctx.beginPath();
      ctx.arc(0, 0, ballRadius, 0, Math.PI * 2);
      ctx.fill();

      // Ball seams / ribs (black)
      ctx.strokeStyle = '#1c1917';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, ballRadius, 0, Math.PI * 2);
      ctx.moveTo(-ballRadius, 0);
      ctx.lineTo(ballRadius, 0);
      ctx.moveTo(0, -ballRadius);
      ctx.lineTo(0, ballRadius);
      ctx.stroke();

      ctx.restore();

      if (frame >= totalFrames) {
        clearInterval(interval);
        setTimeout(() => {
          mediaRecorder?.stop();
        }, 150);
      }
    }, 1000 / 30);
  });
}
