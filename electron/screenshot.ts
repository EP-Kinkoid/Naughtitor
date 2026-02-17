import * as screenshot from 'screenshot-desktop';
import * as fs from 'fs';

export async function captureScreenshot(outputPath: string): Promise<void> {
  const img = await screenshot.default({ format: 'png' });
  fs.writeFileSync(outputPath, img);
}
