import GameSession from "../../../components/GameSession";

export default async function GamePage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  return <GameSession roomId={roomId} />;
}
