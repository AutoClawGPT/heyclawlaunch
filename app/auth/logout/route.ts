export const GET = () => new Response(null, { status: 303, headers: { location: "/", "set-cookie": "hg_session=; Path=/; Max-Age=0" } });
