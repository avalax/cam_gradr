import { writeAllVideos } from './support/synthetic-cards';

// Erzeugt vor den Tests die synthetischen Kameravideos (nicht eingecheckt, siehe .gitignore).
export default function globalSetup(): void {
  writeAllVideos();
}
