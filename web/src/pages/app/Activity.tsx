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
      <PageHead title="Activity" sub="A record of changes across your repositories, including setup pull requests, pause and resume actions, Fix now requests and feedback on runs." />
      {error ? <p className="err">{error}</p> : !data ? <Loading /> : data.length ? <ActivityList events={data} />
        : <Empty title="No activity yet">Changes made by you and other maintainers will be listed here.</Empty>}
    </>
  );
}
