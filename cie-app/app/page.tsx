import Link from "vinext/shims/link";

export default function Home() {
  return (
    <main className="welcome-page">
      <h1 className="welcome-title">Conskill</h1>
      <nav className="login-options" aria-label="Choose workspace">
        <Link className="login-button" href="/user">user</Link>
        <Link className="login-button" href="/admin">admin</Link>
      </nav>
    </main>
  );
}
