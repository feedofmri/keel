import { RunsBrowser } from "../../components/app/RunsBrowser";
import { PageHead } from "../../components/PageHead";
import { useAsync } from "../../hooks/useAsync";
import { useTitle } from "../../hooks/useTitle";
import { api } from "../../lib/api";

export default function Runs() {
  useTitle("Runs · Keel");
  const repos = useAsync(() => api.repos(), []);
  return (
    <>
      <PageHead title="Runs" sub="Every repair Keel ran, across your repositories. Open one to see its candidates and the reasons for its decision." />
      <RunsBrowser repos={repos.data?.repos.filter(r => r.status !== "new").map(r => r.full_name)} />
    </>
  );
}
