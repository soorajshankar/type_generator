import {
  buildClientSchema,
  GraphQLObjectType,
  printSchema,
  isScalarType,
  isNonNullType,
  GraphQLNamedType,
  GraphQLField,
  isListType,
  isObjectType,
  GraphQLSchema
} from "graphql";
import { useEffect, useState } from "react";
import { schema } from "./schema";
import "./styles.css";

console.clear();

const clientSchema = buildClientSchema(schema);

const addImportedTypeSuffixIfNotPresent = (type: string) => {
  if (!type?.endsWith("_ImportedType")) type = `${type}_ImportedType`;
  return type;
};

const getInnerType = (node) => {
  let type = node.type;
  // if (node.name != "Tracks") return;
  // console.log("1>>", node);

  // get exact types - remove ! and []
  // ie. Int! => Int
  // [Int] => Int
  if (isNonNullType(node.type) || isListType(node.type)) {
    type = node.type.ofType;
    if (type.ofType) {
      type = type.ofType;
      if (type.ofType) {
        type = type.ofType; // the maximum it can go is 3 levels, an example is if both the list and inner type is non null [Track!]!
      }
    }
    // console.log("P>>", type);
  }
  return type;

  // console.log({ scalar: isScalarType(type), object: isObjectType(type) });
};

const getAllTypes = (
  clientSchema: GraphQLSchema,
  onlyTableTypes: boolean = false
) => {
  if (onlyTableTypes) {
    return Object.entries(clientSchema.getTypeMap())
      .filter(([tName, tValue]) => {
        if (
          tValue?.description?.startsWith("columns and relationships of ") &&
          clientSchema.getType(tName) instanceof GraphQLObjectType
        )
          return true;
        else return false;
      })
      .map((i) => i[0]);
  } else return Object.keys(clientSchema.getTypeMap());
};
const io_type: "input" | "type" = "input";

// getDependentTypes
const getDependentTypes = (selectedTypes: string[], depth = 1) => {
  const allRequiredTypes = new Set<string>([]);

  console.log("SSS", selectedTypes, clientSchema);
  if (depth > 30) {
    console.log("QQQ");
    return;
  }
  selectedTypes.forEach((type) => {
    Object.entries(
      // asserting because selectedTypes will always have GQL object types
      (clientSchema?.getType(type) as GraphQLObjectType).getFields()
    ).forEach(([key, value]) => {
      const innerType = getInnerType(value);
      if (
        isObjectType(innerType) &&
        innerType.description?.startsWith('columns and relationships of "') &&
        !allRequiredTypes.has(innerType.name) &&
        // TODO fix sufffix issue correctly, following is hack to avoid getting duplicates
        !innerType.name.endsWith("_ImportedType")
      ) {
        allRequiredTypes.add(innerType.name);
        const dependentTypes = getDependentTypes([innerType.name], depth + 1);
        console.log("{{", innerType.name, dependentTypes);
      }
    });
  });
  return Array.from(allRequiredTypes);
};
const generateTypeDef = (typeName: string) => {
  let typeDef = `${io_type} ${typeName}_ImportedType {`;
  Object.entries(
    (clientSchema.getType(typeName) as GraphQLObjectType).getFields()
  ).forEach(([tName, tValue]) => {
    // parse nonNull or List types to find the inner type
    const innerType = getInnerType(tValue);

    // TODO if Object Type, suffix `_ImportedType` to the typeName
    if (isObjectType(innerType)) {
      innerType.name = addImportedTypeSuffixIfNotPresent(innerType.name);

      if (
        // filter out non table types like aggregates
        // TODO check how this can be figured out with GDC
        innerType.description?.startsWith('columns and relationships of "')
      ) {
        typeDef = `${typeDef}
  ${tName} : ${tValue.type.toString()}`;
      }
    }

    // if Scalar Type, re-use the typeName
    else {
      typeDef = `${typeDef}
  ${tName} : ${tValue.type.toString()}`;
    }
  });
  typeDef = `${typeDef}
}`;
  return typeDef;
};

const generateAllTypeDefinitions = (
  clientSchema: GraphQLSchema,
  selectedTypes: string[],
  io_type: "input" | "type"
) => {
  const typeMap = clientSchema.getTypeMap();

  // const dependentTypes = getDependentTypes(selectedTypes);
  // console.log({ selectedTypes, dependentTypes });
  let allTypeDefs = "";

  Object.entries(typeMap).forEach(([key, value], index) => {
    // get types only that generated
    if (
      value?.description?.startsWith("columns and relationships of ") &&
      clientSchema.getType(key) instanceof GraphQLObjectType
    ) {
      // console.log(key, value.description);
      if (!selectedTypes?.includes(key)) return;

      // TODO get Set of dependant types

      // TODO basic type generation for a Node

      const typeDef = generateTypeDef(key);

      allTypeDefs = `${allTypeDefs}${typeDef}
`;
    }
  });
  return allTypeDefs;
};

const allTypes = getAllTypes(clientSchema, true);

export default function App() {
  const [selectedTypes, setSelectedTypes] = useState(["Album"] as string[]);
  const [typeDef, setTypeDef] = useState("");
  useEffect(() => {
    // window.client = clientSchema;
    const allTypeDefs = generateAllTypeDefinitions(
      clientSchema,
      selectedTypes,
      "type"
    );
    // console.log(allTypeDefs);
    setTypeDef(allTypeDefs);
  }, [selectedTypes]);
  // console.log(selectedTypes);
  return (
    <div style={{ width: "100vw" }} className="flex">
      <div className="w-full m-4">
        {allTypes?.map((typeName) => (
          <div className="flex items-center">
            <input
              id="default-checkbox"
              type="checkbox"
              checked={selectedTypes.includes(typeName)}
              className="w-4 h-4 text-blue-600 bg-gray-700 rounded border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2"
              onChange={(e) => {
                const newSet = new Set(selectedTypes);
                if (newSet.has(typeName)) {
                  newSet.delete(typeName);
                } else {
                  newSet.add(typeName);
                }
                setSelectedTypes(Array.from(newSet));
              }}
            />
            <label
              htmlFor="default-checkbox"
              className="ml-2 text-xl font-medium text-gray-900"
            >
              {typeName}
            </label>
          </div>
        ))}
      </div>
      <div className="w-full">
        <pre>
          <code>{typeDef}</code>
        </pre>
      </div>
    </div>
  );
}
