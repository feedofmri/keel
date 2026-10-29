import { useParams } from "react-router-dom";
export const useRepoName = () => { const { owner = "", name = "" } = useParams(); return `${owner}/${name}`; };
