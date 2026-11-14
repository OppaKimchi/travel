import { useRoute } from "./lib/router";
import { useSession } from "./lib/session";
import { isConfigured } from "./lib/supabase";
import { SignIn } from "./components/SignIn";
import { TripList } from "./components/TripList";
import { TripView } from "./components/TripView";

export default function App() {
  if (!isConfigured) return <NotConfigured />;
  return <ConfiguredApp />;
}

function ConfiguredApp() {
  const { ready, user, offline } = useSession();
  const route = useRoute();

  if (!ready) return <main className="centered muted">Loading…</main>;
  if (!user) return <SignIn />;
  if (route.name === "trip") {
    return <TripView key={route.tripId} tripId={route.tripId} tab={route.tab} sessionOffline={offline} />;
  }
  return <TripList user={user} />;
}

function NotConfigured() {
  return (
    <main className="centered">
      <div className="card narrow">
        <p className="eyebrow">Our Trips</p>
        <h1>Almost ready</h1>
        <p>
          The app isn't connected to its Supabase project yet. Add the project URL and publishable key to{" "}
          <code>src/config.ts</code>.
        </p>
      </div>
    </main>
  );
}
