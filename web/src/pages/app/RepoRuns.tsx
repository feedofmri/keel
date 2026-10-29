import { PageHead, RepoCrumbs, RepoTabs } from "../../components/PageHead";
import { RunsBrowser } from "../../components/app/RunsBrowser";
import { useRepoName } from "../../hooks/useRepoName";
import { useTitle } from "../../hooks/useTitle";

export default function RepoRuns() {
  const full = useRepoName();
  useTitle(`Runs · ${full} · Keel`);
  return <><PageHead crumbs={<RepoCrumbs full={full} />} title={full} /><RepoTabs full={full} canManage /><RunsBrowser repo={full} /></>;
}
