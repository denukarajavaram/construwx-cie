import { getDatabase } from "@/lib/db/database";

export async function POST(request: Request) {
  const db = getDatabase();

  const body = await request.json() as {
    name: string;
    description: string;
    requirements: string;
  };

  const { name, description, requirements } = body;

  const result = await db
    .prepare(`
      INSERT INTO roles (name, description, requirements)
      VALUES (?, ?, ?)
    `)
    .bind(name, description, requirements)
    .run();

  return Response.json({
    success: true,
    id: result.meta.last_row_id,
  });
}