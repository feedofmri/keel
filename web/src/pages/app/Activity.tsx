import { ActivityList } from "../../components/app/ActivityList";
import { Empty, Loading } from "../../components/app/Empty";
import { PageHead } from "../../components/PageHead";
import { useAsync } from "../../hooks/useAsync";
import { useTitle } from "../../hooks/useTitle";
import { api } from "../../lib/api";

export default function Activity() {
  useTitle("Activity · Keel");
  const { data, error } = useAsync(() => api.activity(), []);
  return (
    <>
      <PageHead title="Activity" sub="Who changed what, across your repositories: setup pull requests, pause and resume, Fix now, and feedback on runs." />
      {error ? <p className="err">{error}</p> : !data ? <Loading /> : data.length ? <ActivityList events={data} />
        : <Empty title="No activity yet">Changes you and other maintainers make appear here.</Empty>}
    </>
  );
}
