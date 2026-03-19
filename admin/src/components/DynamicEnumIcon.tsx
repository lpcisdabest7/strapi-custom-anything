import { Flex } from '@strapi/design-system';
import { PlusCircle } from '@strapi/icons';
import styled from 'styled-components';

const IconBox = styled(Flex)`
  background-color: #f0f0ff;
  border: 1px solid #d9d8ff;
  svg > path {
    fill: #4945ff;
  }
`;

const DynamicEnumIcon = () => {
  return (
    <IconBox justifyContent="center" alignItems="center" width={7} height={6} hasRadius aria-hidden>
      <PlusCircle />
    </IconBox>
  );
};

export default DynamicEnumIcon;
