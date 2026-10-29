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
      <PageHead title="Runs" sub="All repair runs across your repositories. Select a run to view its candidates and the basis for its decision." />
      <RunsBrowser repos={repos.data?.repos.filter(r => r.status !== "new").map(r => r.full_name)} />
    </>
  );
}
