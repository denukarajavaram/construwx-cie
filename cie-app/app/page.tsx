import Link from "vinext/shims/link";

export default function Home() {
  return (
    <Link href="/add-role"
      style={{
      background: "#ca6fca",
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)"
    }}
    >
      Add Role
    </Link>
  );
}
  

