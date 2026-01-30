import { Link } from 'wouter';

export default function Logo() {
  return (
    <Link href="/">
      <a className="text-2xl font-extrabold tracking-tight flex items-center">
        <span className="text-primary font-['Audiowide',cursive]">modl</span>
        <span className="text-foreground font-['Audiowide',cursive]">.gg</span>
      </a>
    </Link>
  );
}
