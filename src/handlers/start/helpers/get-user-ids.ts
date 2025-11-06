import { Context } from "../../../types/index";

export async function getUserIds(context: Context, username: string[]) {
    const ids = [];
  
    for (const user of username) {
      const { data } = await context.octokit.rest.users.getByUsername({
        username: user,
      });
  
      ids.push(data.id);
    }
  
    if (ids.filter((id) => !id).length > 0) {
      throw new Error("Error while fetching user ids");
    }
  
    return ids;
  }