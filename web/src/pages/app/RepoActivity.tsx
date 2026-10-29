import { ActivityList } from "../../components/app/ActivityList";
import { Empty, Loading } from "../../components/app/Empty";
import { PageHead, RepoCrumbs, RepoTabs } from "../../components/PageHead";
import { useAsync } from "../../hooks/useAsync";
import { useRepoName } from "../../hooks/useRepoName";
import { useTitle } from "../../hooks/useTitle";
import { api } from "../../lib/api";

export default function RepoActivity() {
  const full = useRepoName();
  useTitle(`Activity · ${full} · Keel`);
  const { data, error } = useAsync(() => api.activity(full), [full]);
  return (
    <>
      <PageHead crumbs={<RepoCrumbs full={full} />} title={full} />
      <RepoTabs full={full} canManage />
      {error ? <p className="err">{error}</p> : !data ? <Loading /> : data.length ? <ActivityList events={data} />
        : <Empty title="No activity yet">Setup pull requests, Fix now, pause and resume, and feedback on runs appear here.</Empty>}
    </>
  );
}
