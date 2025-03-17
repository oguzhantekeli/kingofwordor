import { DICTIONARY_API_BASE_URL } from '../constants';

export const checkAnswer = async (answer) => {
  try {
    const response = await fetch(`${DICTIONARY_API_BASE_URL}/${answer}`);
    if (!response.ok) {
      console.error(`Dictionary API error: ${response.statusText}`);
      return false;
    }
    const data = await response.json();
    console.clear();
    if (data.title === 'No Definitions Found') {
      console.error('No, my friend. That was wrong...');
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error fetching definition:', error);
    return false;
  }
};
